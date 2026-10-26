import struct,numpy as np
def read_bin(p):
    b=open(p,'rb').read();n=struct.unpack_from('<I',b,0)[0];o=4;out=[]
    for _ in range(n):
        l=struct.unpack_from('<I',b,o)[0];o+=4;nid=b[o:o+l].decode();o+=l;nv,nt=struct.unpack_from('<II',b,o);o+=8
        V=np.frombuffer(b,np.float32,nv*3,o).reshape(nv,3).copy();o+=nv*12
        T=np.frombuffer(b,np.uint32,nt*3,o).reshape(nt,3).astype(np.int64);o+=nt*12
        C=np.frombuffer(b,np.uint8,nv*3,o).reshape(nv,3).astype(float);o+=nv*3
        out.append((nid,V,T,C))
    return out
