"""K26 election-night fetcher: validation + conversion (dry-run sketch, not wired to anything live)."""
import csv, io, json, sys, hashlib
FIXED = ['סמל ועדה','ברזל','שם ישוב','סמל ישוב','קלפי','ריכוז','שופט','בזב','מצביעים','פסולים','כשרים']
def validate(raw: bytes, prev_rows=None, expected_parties=None):
    errs=[]
    if len(raw)<500: errs.append('too_small')
    head=raw[:400].lstrip(b'\xef\xbb\xbf').lower()
    if head.startswith(b'<') or b'<html' in raw[:2000].lower(): errs.append('html_not_csv')
    try: txt=raw.decode('utf-8-sig')
    except Exception: return None,['not_utf8']+errs
    if errs: return None,errs
    rows=list(csv.DictReader(io.StringIO(txt)))
    if not rows: return None,['no_rows']
    cols=list(rows[0].keys())
    if cols[:len(FIXED)]!=FIXED: errs.append('header_changed')
    if expected_parties and set(cols[len(FIXED):])!=set(expected_parties): errs.append('party_columns_changed')
    keys=set(); bad=0
    if not txt.endswith('\n') and len(txt.splitlines()[-1].split(','))!=len(cols): errs.append('truncated_last_row')
    for r in rows:
        if None in r or None in r.values(): errs.append('ragged_row'); break
        k=(r['סמל ישוב'],r['קלפי'])
        if k in keys: errs.append('duplicate_ballot'); break
        keys.add(k)
        if r['סמל ישוב']=='9999': continue  # external envelopes: eligible=0, checked separately
        try:
            v=int(r['כשרים']); p=int(r['פסולים']); m=int(r['מצביעים'])
            s=sum(int(r[c] or 0) for c in cols[len(FIXED):])
            if s!=v or v+p!=m or m>int(r['בזב'])+0: bad+=1
        except ValueError: bad+=1
    if bad>0.02*len(rows): errs.append(f'inconsistent_rows:{bad}')
    if prev_rows is not None and len(rows)<0.9*prev_rows: errs.append('row_count_dropped')
    return (rows,cols[len(FIXED):],bad),errs
def counted_by_locality(rows, universe):
    """universe: {locality_code: total_ballots} from the ballot list; counted share per locality"""
    from collections import Counter
    c=Counter(r['סמל ישוב'] for r in rows if r['סמל ישוב']!='9999')
    return {k:(c.get(k,0),n) for k,n in universe.items()}
