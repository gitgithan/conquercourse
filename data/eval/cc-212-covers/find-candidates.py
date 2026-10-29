import json,urllib.request,urllib.parse,re,sys,os,time
Q={'shibuya-tokyo':'Shibuya Tokyo skyline','ciutadella-barcelona':'Parc de la Ciutadella','edinburgh-old-town':'Edinburgh Old Town rooftops','positano-italy':'Positano','valletta-harbour-malta':'Valletta Grand Harbour','speicherstadt-hamburg':'Speicherstadt Hamburg','alfama-lisbon':'Alfama Lisbon rooftops','spanish-steps-rome':'Spanish Steps Rome','parc-guell-barcelona':'Park Güell','tuileries-paris':'Jardin des Tuileries','retiro-park-madrid':'Retiro Park Madrid','gas-works-park-seattle':'Gas Works Park Seattle','dolores-park-san-francisco':'Dolores Park San Francisco','piazza-san-marco-venice':'Piazza San Marco Venice','plaza-mayor-madrid':'Plaza Mayor Madrid','trafalgar-square-london':'Trafalgar Square','covent-garden-london':'Covent Garden London','washington-square-new-york':'Washington Square Park','union-square-san-francisco':'Union Square San Francisco','old-town-square-prague':'Old Town Square Prague','piazza-navona-rome':'Piazza Navona','nyhavn-copenhagen':'Nyhavn Copenhagen','boston-common-beacon-hill':'Beacon Hill Boston'}
H={'User-Agent':'ConquerCourseHackathon/1.0 (han.qi91@gmail.com)'}
def api(**k):
    k.update(format='json'); u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(k)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H)))
OK=re.compile(r'^(CC0|Public domain|CC BY(-SA)? [0-9]\.[0-9])$',re.I)
out={}
for slug,q in Q.items():
    r=api(action='query',generator='search',gsrsearch=q+' filetype:bitmap',gsrnamespace=6,gsrlimit=30,prop='imageinfo',iiprop='url|extmetadata|size',iiurlwidth=640)
    c=[]
    for p in sorted(r.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',0)):
        ii=p['imageinfo'][0]; m=ii['extmetadata']; lic=m.get('LicenseShortName',{}).get('value','')
        if not OK.match(lic.replace('Public domain','Public domain')) and not lic.lower().startswith('public domain'): continue
        if ii['width']<ii['height']*1.2 or ii['width']<1200: continue
        a=re.sub('<[^>]+>','',m.get('Artist',{}).get('value','')).strip()
        c.append(dict(title=p['title'],thumb=ii['thumburl'],src=ii['descriptionurl'],lic=lic,author=a))
        if len(c)>=8: break
    out[slug]=c; print(slug,len(c),flush=True); time.sleep(1)
json.dump(out,open('cand.json','w'),indent=1)
