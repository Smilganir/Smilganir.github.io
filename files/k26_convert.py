"""CSV (expb.csv) -> compact live JSON for the Worker. Dry-run tool, not wired to anything live.
usage: python3 k26_convert.py expb.csv party_table.json out.json [--expected-ballots N]
party_table.json: {"election":"k26","bloc":{"<letter>":"right|left|unknown"}}. Letter -> bloc is ALWAYS taken from this table, never from code."""
import json, sys, hashlib, datetime
try:
    from k26_fetch_validate import validate
except ImportError:
    from fetch_validate import validate
def convert(raw, table, expected_ballots, prev_rows=None):
    out, errs = validate(raw, prev_rows=prev_rows)
    if errs: return None, errs
    rows, parties, bad = out
    unk = [p for p in parties if p not in table['bloc']]
    if unk: return None, ['letters_missing_in_table:'+','.join(unk)]
    loc = {}; tot = {'right':0,'left':0,'unknown':0}; valid_total = 0; counted = 0
    for r in rows:
        if r['סמל ישוב'] == '9999': continue  # external envelopes: separate, not geographic
        counted += 1; v = int(r['כשרים']); valid_total += v
        L = loc.setdefault(r['סמל ישוב'], [0, 0, 0, 0, 0])  # ballots, valid, right, left, unknown
        L[0] += 1; L[1] += v
        for p in parties:
            n = int(r[p] or 0)
            if n:
                b = table['bloc'][p]; i = {'right':2,'left':3,'unknown':4}[b]; L[i] += n; tot[b] += n
    return {'schema':1,'election':table['election'],'generated_at':datetime.datetime.utcnow().isoformat()+'Z',
            'source_sha256':hashlib.sha256(raw).hexdigest(),'ballots_total':expected_ballots,'ballots_counted':counted,
            'pct_counted':round(100*counted/expected_ballots,1),'valid_total':valid_total,'bloc_votes':tot,
            'external_envelope_rows':sum(1 for r in rows if r['סמל ישוב']=='9999'),
            'localities':loc,'loc_fields':['ballots','valid','right','left','unknown']}, []
if __name__=='__main__':
    raw=open(sys.argv[1],'rb').read(); t=json.load(open(sys.argv[2])); n=int(sys.argv[sys.argv.index('--expected-ballots')+1])
    res,errs=convert(raw,t,n)
    if errs: print('REJECT',errs); sys.exit(2)
    json.dump(res,open(sys.argv[3],'w'),ensure_ascii=False,separators=(',',':')); print('ok',res['ballots_counted'],res['pct_counted'])
