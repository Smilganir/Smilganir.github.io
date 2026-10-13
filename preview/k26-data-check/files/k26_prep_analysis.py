# K26 prep analysis, as run 2026-10-13. Inputs: data/sources-from-nir/*.xlsx (K26 files) and K25 ballot results from data.gov.il (resource cc223336-07bc-485d-b160-62df92967c0a). Paths are /tmp-based; adjust before rerun.
# --- stage 1: mapping + stable chain coverage ---
import pandas as pd, json, numpy as np
def tab(f,s,cols):
    d=pd.read_excel(f,sheet_name=s,header=None).dropna(how='all').reset_index(drop=True)
    # find header row by first col name
    i=d.index[d.iloc[:,0].astype(str).str.contains(cols,regex=False)][0]
    h=d.loc[i].tolist(); d=d.loc[i+1:]
    d.columns=h; return d.reset_index(drop=True)
k26=pd.read_excel('K26_kalpiot_sofi.xlsx'); 
k26.columns=[c.strip() for c in k26.columns]
print(k26.columns.tolist(), len(k26))
k26['loc']=k26['סמל ישוב בחירות'].astype(int); k26['k']=k26['סמל קלפי'].astype(float); k26['base']=np.floor(k26['k']).astype(int)
k26['voters']=pd.to_numeric(k26['בוחרי כנסת'],errors='coerce')
print('K26 boxes',len(k26),'localities',k26['loc'].nunique(),'voters',int(k26.voters.sum()),'rikuzim',k26.groupby(['loc','סמל רכוז']).ngroups, 'dupe loc+kalpi',k26.duplicated(['loc','k']).sum())
print(k26[k26.k.astype(str).str.contains('9999')].head(2))
print(k26[k26['loc']>=9000][['שם ישוב בחירות','loc']].drop_duplicates().head())
m=tab('K26_cbs_kalpiot_1.xlsx','kalpi_October2026_stat2022','SEMEL_YISHUV'); m.columns=['loc','name','base','stat','ys']
for c in ['loc','base','stat']: m[c]=pd.to_numeric(m[c],errors='coerce')
m=m.dropna(subset=['loc','base']); print('mapping rows',len(m),m.duplicated(['loc','base']).sum())
mk=set(zip(m['loc'].astype(int),m['base'].astype(int)))
k26['mapped']=[ (a,b) in mk for a,b in zip(k26['loc'],k26['base'])]
print('K26 boxes mapped to stat2022:',k26.mapped.sum(),'/',len(k26),'voters',int(k26[k26.mapped].voters.sum()),'/',int(k26.voters.sum()))
um=k26[~k26.mapped]; print('unmapped by locality:'); print(um.groupby('שם ישוב בחירות').agg(boxes=('k','size'),voters=('voters','sum')).sort_values('boxes',ascending=False).head(12))
print('mapping stat NaN',m.stat.isna().sum(),'  mapped keys not in K26', len(mk-set(zip(k26['loc'],k26['base']))))
# stable
s26=tab('K26_cbs_kalpiot_2.xlsx','קלפיות יציבות 2026','שם יישוב'); s26.columns=['loc','name','n']
s22=tab('Stable_kalpi_November2022_K24-K25.xlsx','קלפיות יציבות 2022','שם יישוב'); s22.columns=['name','loc','n']
for d in (s26,s22):
    for c in ['loc','n']: d[c]=pd.to_numeric(d[c],errors='coerce')
    d.dropna(subset=['loc','n'],inplace=True)
print('stable26',len(s26),'stable22',len(s22))
# K25 results
r=json.load(open('/tmp/b25full.json'))['result']['records']; k25=pd.DataFrame(r)
k25['loc']=k25['סמל ישוב'].astype(int); k25['k']=k25['קלפי'].astype(float); k25['base']=np.floor(k25.k).astype(int)
print('K25 boxes',len(k25),'localities',k25['loc'].nunique(),'valid',int(k25['כשרים'].sum()))
a=set(zip(s22['loc'].astype(int),s22.n.astype(int))); b=set(zip(s26['loc'].astype(int),s26.n.astype(int)))
print('stable22 ∩ stable26 (loc,num):',len(a&b),' only22',len(a-b),' only26',len(b-a))
# K25 boxes in stable22 list
k25['st22']=[(x,y) in a for x,y in zip(k25['loc'],k25['base'])]
k25['bridge']=[(x,y) in a and (x,y) in b for x,y in zip(k25['loc'],k25['base'])]
k25['inK26']=[(x,y) in set(zip(k26['loc'],k26['base'])) for x,y in zip(k25['loc'],k25['base'])]
ev=k25[k25['loc']<9000]
tot=ev['כשרים'].sum()
print('K25 non-external boxes',len(ev),'valid',int(tot))
for c in ['st22','bridge','inK26']:
    print(c,int(ev[c].sum()),round(ev[c].sum()/len(ev)*100,1),'% boxes;',int(ev[ev[c]]['כשרים'].sum()),round(ev[ev[c]]['כשרים'].sum()/tot*100,1),'% valid votes')
# K26 side
k26['bridgeable']=[(x,y) in a and (x,y) in b for x,y in zip(k26['loc'],k26['base'])]
print('K26 boxes whose base is bridgeable to K25',k26.bridgeable.sum(),round(k26.bridgeable.mean()*100,1),'% boxes',round(k26[k26.bridgeable].voters.sum()/k26.voters.sum()*100,1),'% voters')
# 9999 ext envelopes in k26?
print('K26 locs>=9000', (k26['loc']>=9000).sum(), 'loc values', sorted(k26[k26['loc']>=9000]['loc'].unique())[:5])
# rikuzim coords
rk=pd.read_excel('K26_rikuzim_sofi.xlsx'); rk.columns=[c.strip() for c in rk.columns]
print('rikuzim',len(rk),'X null',rk.X.isna().sum(),'zero',(pd.to_numeric(rk.X,errors='coerce')==0).sum(),'voters',int(pd.to_numeric(rk['בוחרי כנסת']).sum()),'boxes',int(pd.to_numeric(rk["מס' קלפיות"]).sum()))
k26r=set(zip(k26['loc'],k26['סמל רכוז'].astype(int))); rkk=set(zip(rk['סמל ישוב בחירות'].astype(int),rk['סמל רכוז'].astype(int)))
print('K26 rikuz keys',len(k26r),'covered by rikuzim',len(k26r&rkk),'missing',len(k26r-rkk))
hm=pd.read_excel('K26_doh_hamara_kalpiot.xlsx'); print('hamara rows',len(hm))
k26.to_pickle('/tmp/k26.pkl'); k25.to_pickle('/tmp/k25.pkl'); m.to_pickle('/tmp/map.pkl')

# --- stage 2: K25 bridge stats + unmapped list ---
import pandas as pd,numpy as np,json
k26=pd.read_pickle('/tmp/k26.pkl'); k25=pd.read_pickle('/tmp/k25.pkl'); m=pd.read_pickle('/tmp/map.pkl')
import re
exec(open('/tmp/an.py').read().split("# stable")[0].split("def tab")[0]) if False else None
def tab(f,s,cols):
    d=pd.read_excel('/tmp/x/'+f,sheet_name=s,header=None).dropna(how='all').reset_index(drop=True)
    i=d.index[d.iloc[:,0].astype(str).str.contains(cols,regex=False)][0]
    h=d.loc[i].tolist(); d=d.loc[i+1:]; d.columns=h; return d.reset_index(drop=True)
s26=tab('K26_cbs_kalpiot_2.xlsx','קלפיות יציבות 2026','שם יישוב'); s26.columns=['loc','name','n']
s22=tab('Stable_kalpi_November2022_K24-K25.xlsx','קלפיות יציבות 2022','שם יישוב'); s22.columns=['name','loc','n']
for d in (s26,s22):
    for c in ['loc','n']: d[c]=pd.to_numeric(d[c],errors='coerce')
    d.dropna(subset=['loc','n'],inplace=True)
a=set(zip(s22['loc'].astype(int),s22.n.astype(int))); b=set(zip(s26['loc'].astype(int),s26.n.astype(int)))
ev=k25[k25['loc']!=9999].copy(); tot=ev['כשרים'].sum()
ev['st22']=[(x,y) in a for x,y in zip(ev['loc'],ev['base'])]
ev['bridge']=[(x,y) in a and (x,y) in b for x,y in zip(ev['loc'],ev['base'])]
kb=set(zip(k26['loc'],k26['base']))
ev['inK26']=[(x,y) in kb for x,y in zip(ev['loc'],ev['base'])]
out={'k25_boxes_total':len(k25),'k25_boxes_geo':len(ev),'k25_valid_geo':int(tot),'k25_ext_boxes':int((k25['loc']==9999).sum()),'k25_ext_valid':int(k25[k25['loc']==9999]['כשרים'].sum())}
for c in ['st22','bridge','inK26']:
    out[c]={'boxes':int(ev[c].sum()),'pct_boxes':round(ev[c].mean()*100,1),'valid':int(ev[ev[c]]['כשרים'].sum()),'pct_valid':round(ev[ev[c]]['כשרים'].sum()/tot*100,1)}
k26['bridgeable']=[(x,y) in a and (x,y) in b for x,y in zip(k26['loc'],k26['base'])]
out['k26']={'boxes':len(k26),'voters':int(k26.voters.sum()),'localities':int(k26['loc'].nunique()),'rikuzim':4399,'mapped_boxes':int(k26.mapped.sum()),'mapped_voters':int(k26[k26.mapped].voters.sum()),'bridgeable_boxes':int(k26.bridgeable.sum()),'bridgeable_voters':int(k26[k26.bridgeable].voters.sum()),'mapping_rows':len(m),'mapping_keys_not_in_k26':3828,'stable26':len(s26),'stable22':len(s22),'stable_both':len(a&b)}
um=k26[~k26.mapped].groupby(['loc','שם ישוב בחירות']).agg(boxes=('k','size'),voters=('voters','sum')).reset_index().sort_values('voters',ascending=False)
out['unmapped_localities']=len(um); out['top_unmapped']=um.head(15).rename(columns={'שם ישוב בחירות':'name'}).to_dict('records')
print(json.dumps(out,ensure_ascii=False,indent=1,default=int))
json.dump(out,open('/tmp/k26_mapping_stats.json','w'),ensure_ascii=False,indent=1,default=int)
um.to_csv('/tmp/k26_unmapped_localities.csv',index=False)
print(um.shape, um.voters.sum())
