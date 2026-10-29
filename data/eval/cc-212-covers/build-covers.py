import json,io,re,urllib.request
from PIL import Image
H={'User-Agent':'ConquerCourseHackathon/1.0 (han.qi91@gmail.com)'}
P={'shibuya-tokyo':3,'ciutadella-barcelona':1,'edinburgh-old-town':4,'positano-italy':3,'valletta-harbour-malta':4,'speicherstadt-hamburg':5,'alfama-lisbon':0,'parc-guell-barcelona':3,'tuileries-paris':2,'retiro-park-madrid':7,'gas-works-park-seattle':3,'dolores-park-san-francisco':7,'piazza-san-marco-venice':5,'plaza-mayor-madrid':2,'trafalgar-square-london':5,'covent-garden-london':0,'washington-square-new-york':1,'union-square-san-francisco':1,'old-town-square-prague':1,'piazza-navona-rome':2,'nyhavn-copenhagen':1,'boston-common-beacon-hill':0}
c=json.load(open('cand.json'));ss=json.load(open('ss.json'))
chosen={s:c[s][i] for s,i in P.items()}
chosen['spanish-steps-rome']=ss[4]
D='/home/hanqi/code/conquercourse-slice2/public/assets/places/thumbs/'
idx=json.load(open(D+'index.json'))
for s,x in chosen.items():
    im=Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(x['thumb'],headers=H)).read())).convert('RGB')
    w,h=im.size;th=w*9/16
    if th<=h:t=0 if s in ('spanish-steps-rome','washington-square-new-york') else (h-th)/2;box=(0,t,w,t+th)
    else:cw=h*16/9;l=(w-cw)/2;box=(l,0,l+cw,h)
    im=im.crop(tuple(int(v) for v in box))
    if s in ('spanish-steps-rome','washington-square-new-york'):
        W,Hh=im.size;z=0.82;im=im.crop((int(W*(1-z)/2),0,int(W*(1+z)/2),int(Hh*z)))
    im=im.resize((320,180),Image.LANCZOS)
    for q in (85,80,75,70,65,60):
        b=io.BytesIO();im.save(b,'JPEG',quality=q,optimize=True,progressive=True)
        if b.tell()<=39000:break
    open(D+s+'.jpg','wb').write(b.getvalue())
    m=re.match(r'^(CC0|Public domain|CC BY(-SA)? ([0-9]\.[0-9]))$',x['lic'])
    lic=x['lic']
    u={'CC BY':'by','CC BY-SA':'by-sa'}
    mm=re.match(r'^(CC BY(?:-SA)?) ([0-9.]+)$',lic)
    lu=f"https://creativecommons.org/licenses/{u[mm.group(1)]}/{mm.group(2)}" if mm else ('https://creativecommons.org/publicdomain/zero/1.0' if lic=='CC0' else 'https://creativecommons.org/publicdomain/mark/1.0')
    idx[s]=dict(title=x['title'][5:],author=x['author'][:80],licence=lic,licenceUrl=lu,source=x['src'])
    print(s,q,b.tell(),lic,'|',x['author'][:50])
json.dump(idx,open(D+'index.json','w'),indent=2,ensure_ascii=False);open(D+'index.json','a').write('\n')
json.dump(chosen,open('chosen.json','w'),indent=2)
