/* Locality-only turnout comparison: with / without external ("double") envelopes, K25 (2022).
   Separate preview page. Does not touch the main election map. Colours and bins are the main map's own. */
(function () {
  'use strict'
  var TURNOUT_BUCKETS = [[0,'#440154'],[40,'#3b528b'],[50,'#31688e'],[60,'#21918c'],[70.6,'#5ec962'],[80,'#90d743'],[90,'#fde725']]
  var COALITION_BUCKETS = [[0,'#CB181D'],[15,'#EF3B2C'],[30,null],[45,null],[55,null],[70,'#4292C6'],[85,'#2171B5']]
  var NATIONAL_AVG = 70.6
  function bucketColor(v, b) { var c = b[0][1]; for (var i = 0; i < b.length; i++) if (v >= b[i][0]) c = b[i][1]; return c }
  var fmt = function (n) { return Number(n).toLocaleString('en-US') }
  var f1 = function (n) { return (Math.round(n * 10) / 10).toFixed(1) }

  var passing = {}, F = { rel: 'all', so: [1, 10], nd: false, co: [0, 100], tu: [30, 100], lp: '' }
  var DATA = null, GEO = null, mode = 'without', metric = 'coalition', sortKey = 'd', sortDir = 'desc', selected = null, query = ''
  var $ = function (s) { return document.querySelector(s) }

  maplibregl.setRTLTextPlugin('mapbox-gl-rtl-text.js', true)
  var map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: {
        omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors' },
        mask: { type: 'geojson', data: 'basemap/israel_land_mask.geojson' },
        border: { type: 'geojson', data: 'basemap/territory_border.geojson' }
      },
      layers: [
        { id: 'land', type: 'background', paint: { 'background-color': '#d9d9d9' } },
        { id: 'il', type: 'fill', source: 'mask', filter: ['==', ['get', 'NAME_EN'], 'Israel'], paint: { 'fill-color': '#F6F4F4' } },
        { id: 'ps', type: 'fill', source: 'mask', filter: ['==', ['get', 'NAME_EN'], 'Palestine'], paint: { 'fill-color': '#F6F4F4' } },
        { id: 'bd', type: 'line', source: 'border', paint: { 'line-color': 'rgba(90,90,90,0.28)', 'line-width': 0.5 } },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#cad2d3' } },
        { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': '#cad2d3', 'line-width': 0.8 } }
      ]
    },
    bounds: [[34.2, 29.45], [35.95, 33.4]], fitBoundsOptions: { padding: { top: 70, bottom: 30, left: 20, right: 20 } },
    minZoom: 6, maxZoom: 12.5, dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: false, fadeDuration: 0
  })
  map.touchZoomRotate.disableRotation()
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

  Promise.all([fetch('data.json').then(function (r) { return r.json() }), fetch('settlements.geojson').then(function (r) { return r.json() })]).then(function (r) {
    DATA = r[0]; GEO = r[1]
    // per-locality derived values: before / after / delta from the CEC file's own percentages
    Object.keys(DATA).forEach(function (k) { var d = DATA[k]; d.dx = 100 * d.x / d.e; d.d = Math.floor(d.dx * 10 + 0.5) / 10 /* delta from unrounded envelopes / eligible, not from subtracting rounded percentages */ })
    GEO.features.forEach(function (f) {
      var d = DATA[f.properties.s]; f.properties.cw = d.q != null ? bucketColor(d.q, TURNOUT_BUCKETS) : '#fff'
    })
    if (map.loaded()) init(); else map.once('load', init)
  })

  function fillExpr() {
    var key = mode === 'with' ? 'cw' : (metric === 'coalition' ? 'cc' : metric === 'party' ? 'cp' : 'ct')
    return ['get', key]
  }
  function init() {
    map.addSource('loc', { type: 'geojson', data: GEO, promoteId: 's' })
    var pts = { type: 'FeatureCollection', features: GEO.features.map(function (f) {
      var xs = [], ys = []; var ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]
      ring.forEach(function (c) { xs.push(c[0]); ys.push(c[1]) })
      var d = DATA[f.properties.s]
      return { type: 'Feature', properties: { n: d.n, e: d.e, s: f.properties.s }, geometry: { type: 'Point', coordinates: [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2] } }
    }) }
    map.addSource('lab', { type: 'geojson', data: pts })
    map.addLayer({ id: 'loc-fill', type: 'fill', source: 'loc', paint: { 'fill-color': fillExpr(), 'fill-opacity': 1 } })
    map.addLayer({ id: 'loc-line', type: 'line', source: 'loc', paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.15, 11, 0.6], 'line-opacity': 0.8 } })
    map.addLayer({ id: 'loc-sel', type: 'line', source: 'loc', paint: { 'line-color': '#111', 'line-width': 1.6 }, filter: ['==', ['get', 's'], ''] })
    map.addLayer({ id: 'labels', type: 'symbol', source: 'lab', minzoom: 7.5, layout: {
      'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 7.5, 10, 11.5, 12],
      'text-max-width': 8, 'symbol-sort-key': ['-', ['get', 'e']], 'text-padding': 3
    }, paint: { 'text-color': '#222', 'text-halo-color': 'rgba(255,255,255,.9)', 'text-halo-width': 1.2 } })
    map.on('click', 'loc-fill', function (e) { select(e.features[0].properties.s, false) })
    map.on('mouseenter', 'loc-fill', function () { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'loc-fill', function () { map.getCanvas().style.cursor = '' })
    wire(); wireFilters(); applyFilters(); render()
  }

  function setMode(m) {
    mode = m
    document.querySelectorAll('#mode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)) })
    $('#metrics').classList.toggle('locked', m === 'with')
    if (m === 'with') { document.querySelector('input[value=turnout]').checked = true }
    else { var c = document.querySelector('input[name=metric]:checked'); metric = c ? c.value : 'turnout' }
    render()
  }
  function render() {
    if (m_ready()) map.setPaintProperty('loc-fill', 'fill-color', fillExpr())
    legend(); drawerVis(); if (selected) card(selected); if (Object.keys(passing).length) applyFilters()
  }
  function m_ready() { return !!map.getLayer('loc-fill') }

  function legend() {
    var el = $('#legend'), h = ''
    var t = mode === 'with' || metric === 'turnout'
    if (t) {
      h = '<h3>' + (mode === 'with' ? 'אחוז הצבעה כולל מעטפות כפולות' : 'אחוז הצבעה (ללא מעטפות כפולות)') + '</h3><div class="ramp">' +
        TURNOUT_BUCKETS.map(function (b) { return '<span style="background:' + b[1] + '"></span>' }).join('') + '</div>' +
        '<div class="ticks"><span>0</span><span>40</span><span>50</span><span>60</span><span>70.6</span><span>80</span><span>90+</span></div>' +
        '<div class="ticks" style="justify-content:center">הממוצע הארצי (70.6%) הוא נקודת העיגון, בשני המצבים</div>'
    } else if (metric === 'coalition') {
      var cols = ['#CB181D', '#EF3B2C', '#FC9272', '#d8c0c6', '#9ECAE1', '#4292C6', '#2171B5']
      h = '<h3>% קולות לקואליציה (גוש)</h3><div class="ramp">' + cols.map(function (c) { return '<span style="background:' + c + '"></span>' }).join('') + '</div>' +
        '<div class="ticks"><span>0</span><span>15</span><span>30</span><span>45</span><span>55</span><span>70</span><span>85+</span></div>'
    } else {
      var cnt = {}, colr = {}
      GEO.features.forEach(function (f) { var d = DATA[f.properties.s]; cnt[d.w] = (cnt[d.w] || 0) + 1; colr[d.w] = f.properties.cp })
      var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] }).slice(0, 8)
      h = '<h3>מפלגה מובילה ביישוב</h3>' + top.map(function (p) { return '<div class="sw"><i style="background:' + colr[p] + '"></i>' + p + '</div>' }).join('')
    }
    el.innerHTML = h
  }

  function card(s) {
    var d = DATA[s], el = $('#card'), rows
    if (mode === 'without') {
      var kp = d._kpi
      rows = '<dt>% קולות לקואליציה</dt><dd><bdi dir="ltr">' + f1(d.c) + '%</bdi></dd><dt>מפלגה מובילה</dt><dd style="direction:rtl">' + d.w + '</dd>' +
        '<hr><dt>אחוז הצבעה</dt><dd class="big"><bdi dir="ltr">' + f1(d.p) + '%</bdi></dd>'
    } else {
      rows = '<dt>בעלי זכות בחירה</dt><dd><bdi dir="ltr">' + fmt(d.e) + '</bdi></dd>' +
        '<dt>מצביעים בקלפיות היישוב</dt><dd><bdi dir="ltr">' + fmt(d.v) + '</bdi></dd>' +
        '<dt>מעטפות חיצוניות (מצביעים שנוספו)</dt><dd><bdi dir="ltr">+' + fmt(d.x) + '</bdi></dd><hr>' +
        '<dt>אחוז הצבעה ללא מעטפות</dt><dd><bdi dir="ltr">' + f1(d.p) + '%</bdi></dd>' +
        '<dt>אחוז הצבעה עם מעטפות</dt><dd class="big"><bdi dir="ltr">' + f1(d.q) + '%</bdi></dd>' +
        '<dt>שינוי</dt><dd><bdi dir="ltr">' + (d.d >= 0 ? '+' : '') + f1(d.d) + '</bdi> נק׳ אחוז</dd>'
    }
    el.innerHTML = '<h3><span>' + d.n + '</span><button aria-label="סגירה" id="card-x">×</button></h3><dl>' + rows + '</dl>'
    el.hidden = false
    $('#card-x').onclick = function () { clearSel() }
  }
  function select(s, fly) {
    selected = s
    map.setFilter('loc-sel', ['==', ['get', 's'], s]); card(s)
    if (fly) { var f = GEO.features.filter(function (x) { return x.properties.s === s })[0]; var ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]
      var b = new maplibregl.LngLatBounds(ring[0], ring[0]); ring.forEach(function (c) { b.extend(c) })
      var mob = window.matchMedia('(max-width:700px)').matches, open = mode === 'with' && !$('#drawer').hidden
      map.fitBounds(b, { padding: mob && open ? { top: 120, left: 40, right: 40, bottom: Math.round(window.innerHeight * 0.62) + 20 } : 80, maxZoom: 11, duration: 600 }) }
    if (mode === 'with') {
      if (query && DATA[s].n.indexOf(query.trim()) < 0) { query = ''; $('#q').value = ''; table() }
      var tr = null; document.querySelectorAll('#drawer tbody tr').forEach(function (r) { var on = r.dataset.s === s; r.classList.toggle('sel', on); if (on) tr = r })
      if (tr && !$('#drawer').hidden) tr.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
  }
  function clearSel() { selected = null; $('#card').hidden = true; map.setFilter('loc-sel', ['==', ['get', 's'], '']); document.querySelectorAll('#drawer tbody tr.sel').forEach(function (r) { r.classList.remove('sel') }) }

  function drawerVis() {
    var on = mode === 'with'
    $('#drawer-toggle').hidden = !on
    if (!on) { $('#drawer').hidden = true; return }
    if ($('#drawer-toggle').getAttribute('aria-expanded') !== 'false') $('#drawer').hidden = false
  }
  function table() {
    var keys = Object.keys(DATA), q = query.trim()
    var rows = keys.filter(function (k) { return passing[k] && (!q || DATA[k].n.indexOf(q) >= 0) })
    rows.sort(function (a, b) {
      var kk = sortKey === 'd' ? 'dx' : sortKey, x = DATA[a][kk], y = DATA[b][kk]
      if (sortKey === 'n') return sortDir === 'asc' ? x.localeCompare(y, 'he') : y.localeCompare(x, 'he')
      return sortDir === 'asc' ? x - y : y - x
    })
    $('#drawer tbody').innerHTML = rows.map(function (k) { var d = DATA[k]
      return '<tr data-s="' + k + '"' + (k === selected ? ' class="sel"' : '') + '><td class="name">' + d.n + '</td><td class="num"><i class="dot" style="background:' + bucketColor(d.p, TURNOUT_BUCKETS) + '"></i>' + f1(d.p) + '%</td><td class="num"><i class="dot" style="background:' + bucketColor(d.q, TURNOUT_BUCKETS) + '"></i>' + f1(d.q) + '%</td><td class="num">' + (d.d >= 0 ? '+' : '') + f1(d.d) + '</td><td class="num">+' + fmt(d.x) + '</td></tr>' }).join('')
    document.querySelectorAll('#drawer th').forEach(function (th) { if (th.classList.contains('sortable')) th.dataset.dir = th.dataset.key === sortKey ? sortDir : '' })
  }
  function sortBy(k) {
    if (sortKey === k) sortDir = sortDir === 'desc' ? 'asc' : 'desc'
    else { sortKey = k; sortDir = 'desc' }
    table()
  }

  /* ---- filters: same inventory and pass rules as the main map's settlement filters ---- */
  function turnoutOf(d) { return mode === 'with' ? d.q : d.p }
  function isFull(r, lo, hi) { return r[0] <= lo && r[1] >= hi }
  function passes(d) {
    if (F.rel === 'jewish' && d.r !== 'j') return false
    if (F.rel === 'non_jewish' && d.r !== 'n') return false
    if (!isFull(F.so, 1, 10)) { if (d.si == null) { if (!F.nd) return false } else if (d.si < F.so[0] || d.si > F.so[1]) return false }
    if (!isFull(F.co, 0, 100)) { var c = Math.round(d.c); if (c < F.co[0] || c > F.co[1]) return false }
    if (!isFull(F.tu, 30, 100)) { var t = turnoutOf(d); if (t == null) return false; t = Math.round(t); if (t < F.tu[0] || t > F.tu[1]) return false }
    if (F.lp && d.w !== F.lp) return false
    return true
  }
  function filtersActive() { return F.rel !== 'all' || !isFull(F.so, 1, 10) || !isFull(F.co, 0, 100) || !isFull(F.tu, 30, 100) || !!F.lp }
  function applyFilters() {
    var ids = [], n = 0, tot = 0
    Object.keys(DATA).forEach(function (k) { tot++; var ok = passes(DATA[k]); passing[k] = ok; if (ok) { ids.push(k); n++ } })
    var act = filtersActive(), fx = act ? ['in', ['get', 's'], ['literal', ids]] : null
    if (m_ready()) { map.setFilter('loc-fill', fx); map.setFilter('loc-line', fx); map.setFilter('labels', fx) }
    $('#flt-count').textContent = act ? 'מוצגים ' + fmt(n) + ' מתוך ' + fmt(tot) + ' יישובים' : 'כל ' + fmt(tot) + ' היישובים מוצגים'
    $('#flt-n').textContent = act ? '(' + fmt(n) + ')' : ''
    $('#flt-clear').disabled = !act
    $('#tu-legend').textContent = mode === 'with' ? 'אחוזי הצבעה (עם מעטפות כפולות)' : 'אחוזי הצבעה (ללא מעטפות כפולות)'
    $('#flt-note').hidden = mode !== 'with'
    if (selected && !passing[selected]) clearSel()
    if (mode === 'with') table()
  }
  function wireFilters() {
    var cnt = {}; Object.keys(DATA).forEach(function (k) { cnt[DATA[k].w] = (cnt[DATA[k].w] || 0) + 1 })
    $('#lp').innerHTML = '<option value="">כל המפלגות</option>' + Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] }).map(function (p) { return '<option value="' + p + '">' + p + '</option>' }).join('')
    function pair(id, key, suffix, lo, hi) {
      var a = $('#' + id + '-min'), b = $('#' + id + '-max')
      function upd(which) {
        var x = Number(a.value), y = Number(b.value)
        if (x > y) { if (which === 'min') { y = x; b.value = y } else { x = y; a.value = x } }
        F[key] = [x, y]; $('#' + id + '-min-v').textContent = x + suffix; $('#' + id + '-max-v').textContent = y + suffix; applyFilters()
      }
      a.oninput = function () { upd('min') }; b.oninput = function () { upd('max') }
    }
    pair('so', 'so', '', 1, 10); pair('co', 'co', '%', 0, 100); pair('tu', 'tu', '%', 30, 100)
    document.querySelectorAll('input[name=rel]').forEach(function (i) { i.onchange = function () { F.rel = i.value; applyFilters() } })
    $('#so-nd').onchange = function () { F.nd = this.checked; applyFilters() }
    $('#lp').onchange = function () { F.lp = this.value; applyFilters() }
    $('#flt-clear').onclick = function () {
      F = { rel: 'all', so: [1, 10], nd: false, co: [0, 100], tu: [30, 100], lp: '' }
      document.querySelector('input[name=rel][value=all]').checked = true
      ;[['so', 1, 10, ''], ['co', 0, 100, '%'], ['tu', 30, 100, '%']].forEach(function (z) { $('#' + z[0] + '-min').value = z[1]; $('#' + z[0] + '-max').value = z[2]; $('#' + z[0] + '-min-v').textContent = z[1] + z[3]; $('#' + z[0] + '-max-v').textContent = z[2] + z[3] })
      $('#so-nd').checked = false; $('#lp').value = ''; applyFilters()
    }
    var mob = function () { return window.matchMedia('(max-width:700px)').matches }
    $('#flt').addEventListener('toggle', function () { if (this.open && mob()) { $('#drawer-toggle').setAttribute('aria-expanded', 'false'); $('#drawer').hidden = true } })
  }
  function wire() {
    document.querySelectorAll('#mode button').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode) } })
    document.querySelectorAll('input[name=metric]').forEach(function (i) { i.onchange = function () { metric = i.value; render() } })
    document.querySelectorAll('#drawer th.sortable').forEach(function (th) {
      th.onclick = function () { sortBy(th.dataset.key) }
      th.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(th.dataset.key) } }
    })
    $('#q').oninput = function () { query = this.value; table() }
    $('#drawer tbody').onclick = function (e) { var tr = e.target.closest('tr'); if (tr) select(tr.dataset.s, true) }
    $('#drawer-toggle').onclick = function () { var open = this.getAttribute('aria-expanded') !== 'false'; this.setAttribute('aria-expanded', String(!open)); $('#drawer').hidden = open; if (!open && window.matchMedia('(max-width:700px)').matches) $('#flt').open = false }
    $('#drawer-x').onclick = function () { $('#drawer-toggle').setAttribute('aria-expanded', 'false'); $('#drawer').hidden = true; $('#drawer-toggle').focus() }
    sortKey = 'd'; sortDir = 'desc'
    if (window.matchMedia('(max-width:700px)').matches) $('#drawer-toggle').setAttribute('aria-expanded', 'false')
  }
})()
