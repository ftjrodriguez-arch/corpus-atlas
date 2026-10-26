"""Read VH_F_United.glb (HRA, CC BY 4.0) into a list of meshes with group path."""
import json,struct,numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def load(path):
    b=open(path,'rb').read();jl=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+jl]);bin0=20+jl+8
    def acc(i):
        a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];dt=CT[a['componentType']];nc=NC[a['type']]
        off=bin0+bv.get('byteOffset',0)+a.get('byteOffset',0);st=bv.get('byteStride',0);isz=np.dtype(dt).itemsize*nc
        if st and st!=isz:
            raw=np.frombuffer(b,np.uint8,count=st*(a['count']-1)+isz,offset=off)
            arr=np.lib.stride_tricks.as_strided(raw,(a['count'],isz),(st,1)).copy().view(dt).reshape(a['count'],nc)
        else: arr=np.frombuffer(b,dt,count=a['count']*nc,offset=off).reshape(a['count'],nc)
        return arr
    out=[]
    def walk(i,path):
        n=g['nodes'][i];p=path+[n.get('name','')]
        if 'mesh' in n:
            Vs=[];Ts=[];o=0
            for pr in g['meshes'][n['mesh']]['primitives']:
                V=acc(pr['attributes']['POSITION']).astype(np.float64);T=acc(pr['indices']).reshape(-1,3).astype(np.int64)+o;o+=len(V);Vs.append(V);Ts.append(T)
            out.append({'name':n['name'],'path':p,'V':np.concatenate(Vs),'T':np.concatenate(Ts)})
        for c in n.get('children',[]): walk(c,p)
    for r in g['scenes'][0]['nodes']: walk(r,[])
    return out
