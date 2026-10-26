import numpy as np
from PIL import Image, ImageDraw
def rot(th,ph):
    # th: azimuth around y, ph: elevation
    cy,sy=np.cos(th),np.sin(th);cx,sx=np.cos(ph),np.sin(ph)
    Ry=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]]);Rx=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]]);return Rx@Ry
def panel(objs,th,ph,W=420,H=420,c=None,ext=None):
    allV=np.concatenate([o[0] for o in objs]);c=c if c is not None else (allV.min(0)+allV.max(0))/2;ext=ext or (allV.max(0)-allV.min(0)).max()
    R=rot(th,ph);img=Image.new('RGB',(W,H),(25,25,25));d=ImageDraw.Draw(img);L=np.array([0.3,0.5,0.8]);L/=np.linalg.norm(L)
    Z=[];P=[];K=[]
    for V,T,col in objs:
        X=((V-c)/ext)@R.T;a,b,cc=X[T[:,0]],X[T[:,1]],X[T[:,2]];n=np.cross(b-a,cc-a);n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-12
        sh=np.clip(np.abs(n@L),0.2,1);Z.append((a[:,2]+b[:,2]+cc[:,2])/3);P.append(np.stack([a,b,cc],1));K.append(np.array(col)[None]*sh[:,None])
    Z=np.concatenate(Z);P=np.concatenate(P);K=np.concatenate(K);s=min(W,H)*0.9
    for i in np.argsort(Z):
        d.polygon([(W/2+p[0]*s,H/2-p[1]*s) for p in P[i]],fill=tuple(K[i].astype(int)))
    return img
def sheet(objs,views,path,**kw):
    ims=[panel(objs,th,ph,**kw) for th,ph in views];W=sum(i.width for i in ims);o=Image.new('RGB',(W,ims[0].height));x=0
    for i in ims:o.paste(i,(x,0));x+=i.width
    o.save(path)
