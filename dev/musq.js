window.__musQ=function(re,side){side=side||'derecho';const rx=new RegExp(re);
 const bones=__T.meshes.filter(m=>m.userData.c&&m.userData.sys&&/oseo/.test(m.userData.sys)&&/^(Humerus|Scapula|Clavicle|.* rib|Sternum|Manubrium.*|Body of sternum|Vertebra .*|Hip bone|Femur|Sacrum|Coccyx|Patella|Tibia|Fibula)$/.test(m.userData.c.en)&&m.visible!==false);
 const cs=0.008,H=new Map(),key=(x,y,z)=>((Math.floor(x/cs)*73856093)^(Math.floor(y/cs)*19349663)^(Math.floor(z/cs)*83492791));
 for(const m of bones){const P=m.geometry.attributes.position.array,N=m.geometry.attributes.normal.array;for(let i=0;i<P.length;i+=3){const k=key(P[i],P[i+1],P[i+2]);let b=H.get(k);if(!b)H.set(k,b=[]);b.push(P[i],P[i+1],P[i+2],N[i],N[i+1],N[i+2],m.userData.c.en);}}
 const out=[];
 for(const m of __T.meshes){const c=m.userData.c;if(!c||!/muscular/.test(m.userData.sys||'')||c.side!==side||!rx.test(c.en)||m.visible===false)continue;
  const P=m.geometry.attributes.position.array,R=m.userData.rest||P,n=P.length/3;let ins=0;const ib={};
  for(let i=0;i<n;i++){const x=P[i*3],y=P[i*3+1],z=P[i*3+2];const fx=Math.floor(x/cs),fy=Math.floor(y/cs),fz=Math.floor(z/cs);let bd=1e9,bb=null,bo=0;
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let d=-1;d<=1;d++){const L=H.get(((fx+a)*73856093)^((fy+b)*19349663)^((fz+d)*83492791));if(!L)continue;for(let t=0;t<L.length;t+=7){const q=(L[t]-x)**2+(L[t+1]-y)**2+(L[t+2]-z)**2;if(q<bd){bd=q;bb=L;bo=t;}}}
   if(bb){const dot=(x-bb[bo])*bb[bo+3]+(y-bb[bo+1])*bb[bo+4]+(z-bb[bo+2])*bb[bo+5];if(dot<-0.002){ins++;const bn=bb[bo+6].replace(/ rib$/,'r');ib[bn]=(ib[bn]||0)+1;}}}
  // edge strain
  const I=m.geometry.index?m.geometry.index.array:null;let lo=0,hi=0,ne=0;if(I){for(let t=0;t<I.length;t+=3){for(const [a,b] of [[I[t],I[t+1]],[I[t+1],I[t+2]]]){const l0=Math.hypot(R[a*3]-R[b*3],R[a*3+1]-R[b*3+1],R[a*3+2]-R[b*3+2]);if(l0<1e-5)continue;const l1=Math.hypot(P[a*3]-P[b*3],P[a*3+1]-P[b*3+1],P[a*3+2]-P[b*3+2]);const r=l1/l0;ne++;if(r<0.5)lo++;if(r>2)hi++;}}}
  let gl='';const mf=m.userData.mf;if(mf&&mf.t){const a=[0,0,0,0],b=[0,0,0,0],a0=[0,0,0],b0=[0,0,0];for(let i=0;i<n;i++){const t=mf.t[i];const T=t<0.1?a:t>0.9?b:null;const T0=t<0.1?a0:t>0.9?b0:null;if(!T)continue;T[0]+=P[i*3];T[1]+=P[i*3+1];T[2]+=P[i*3+2];T[3]++;T0[0]+=R[i*3];T0[1]+=R[i*3+1];T0[2]+=R[i*3+2];}if(a[3]&&b[3]){const d1=Math.hypot(a[0]/a[3]-b[0]/b[3],a[1]/a[3]-b[1]/b[3],a[2]/a[3]-b[2]/b[3]),d0=Math.hypot(a0[0]/a[3]-b0[0]/b[3],a0[1]/a[3]-b0[1]/b[3],a0[2]/a[3]-b0[2]/b[3]);gl=(d1/d0).toFixed(2);}}
  out.push([c.en,n,ins,+(100*ins/n).toFixed(1),+(100*lo/Math.max(1,ne)).toFixed(1),+(100*hi/Math.max(1,ne)).toFixed(1),gl,JSON.stringify(ib)]);}
 out.sort((a,b)=>b[3]-a[3]);return out;};
