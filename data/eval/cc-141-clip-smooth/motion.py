import subprocess,sys,numpy as np
f=sys.argv[1]
W,H=720,1280
raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-vf','crop=720:780:0:250,format=gray','-f','rawvideo','-'],capture_output=True).stdout
n=len(raw)//(W*780); a=np.frombuffer(raw,np.uint8).reshape(n,780,W).astype(np.int16)
d=[float(np.abs(a[i]-a[i-1]).mean()) for i in range(1,n)]
d=np.array(d)
print('frames',n,'identical-to-previous',int((d<0.01).sum()),'unique',n-int((d<0.01).sum()))
run=d[:n-1-45]
print('in run: identical',int((run<0.01).sum()),'mean diff %.2f'%run.mean(),'std %.2f'%run.std(),'min/max %.2f %.2f'%(run.min(),run.max()))
idx=[i+1 for i,x in enumerate(d) if x<0.01]
print('dup frame indexes',idx[:60])
print('first 40 diffs',' '.join('%.1f'%x for x in d[:40]))
print('diffs 40-120',' '.join('%.2f'%x for x in d[40:120]))
print('diffs 270-326',' '.join('%.2f'%x for x in d[270:326]))
