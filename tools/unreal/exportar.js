#!/usr/bin/env node
/* Corpus Atlas → Unreal Engine: exporta todos los modelos de la web a GLB sin comprimir.

   Uso:   node tools/unreal/exportar.js [carpeta_de_salida]
   Salida (por defecto unreal/CorpusAtlas/Importar/):
     hombre/<sistema>.glb   cuerpo de hombre, con la mejor geometría de cada pieza
                            (corazón HRA > alta resolución regional > capa ligera) y las piezas modeladas en Blender
     mujer/<sistema>.glb    piezas que cambian en el cuerpo de mujer (pelvis, periné, piel, mama, reproductor)
     vh/<sistema>.glb       Visible Human Female (capas f_*)
     manifiesto.json        índice de piezas (archivo, sistema, triángulos, centro y caja)
     datos/*.json           copia de data/ (catálogo, rig, fichas, idiomas, lecciones…)

   Cada pieza es una malla cuyo nombre es el id del catálogo (n1528, x12, f0…), igual que en la web.
   Atributos: POSITION (metros, Y arriba, como glTF), NORMAL (suavizada),
              COLOR_0  R = oclusión ambiental, G = tendón/aponeurosis, B = cartílago articular, A = 255
              TANGENT  dirección de la fibra (músculos y ligamentos) o del eje (vasos y nervios), para brillo anisótropo
   Unreal convierte solo a centímetros y Z arriba al importar glTF. */
'use strict';
const fs=require('fs'),path=require('path');
const RAIZ=path.resolve(__dirname,'..','..');
const SAL=path.resolve((require.main===module&&process.argv[2])||path.join(RAIZ,'unreal','CorpusAtlas','Importar'));
const lee=f=>JSON.parse(fs.readFileSync(path.join(RAIZ,f),'utf8'));

/* Capas de la web (index.html, tabla SYS): sexo y capa base de la que toma el material */
const SYS={oseo:{},muscular:{},insercion:{},articular:{},fascia:{},bolsas:{},arterial:{},venoso:{},linfatico:{},
 nervioso_central:{},nervioso_periferico:{},respiratorio:{},digestivo:{},urinario:{},reproductor:{sex:'m'},
 reproductor_f:{sex:'f',base:'reproductor'},endocrino:{},mama:{sex:'f',base:'reproductor'},piel:{sex:'m'},piel_f:{sex:'f',base:'piel'},
 f_piel:{sex:'vh',base:'piel'},f_mama:{sex:'vh',base:'reproductor'},f_oseo:{sex:'vh',base:'oseo'},f_articular:{sex:'vh',base:'articular'},
 f_muscular:{sex:'vh',base:'muscular'},f_reproductor:{sex:'vh',base:'reproductor'},f_visceras:{sex:'vh',base:'digestivo'},
 f_vasos:{sex:'vh',base:'arterial'},f_nervioso:{sex:'vh',base:'nervioso_central'},f_ojos:{sex:'vh',base:'nervioso_central'}};
const BS=k=>SYS[k].base||k;
const TUBOS=['arterial','venoso','nervioso_periferico','linfatico'];
const LIGRX=/ligament|membrane|cord\b|capsul|frenula|retinacul/i;
const HRREG=['superior','inferior','tronco','cabeza'];

const CAT={};for(const r of lee('data/catalog.json'))CAT[r[0]]=r;
const FEM=lee('data/fem.json');for(const r of FEM.cat)if(!CAT[r[0]])CAT[r[0]]=r;
const SEAM=lee('data/seam.json'),NUEVOS=lee('data/nuevos.json'),HRA_HIDE=lee('data/heart_hra_hide.json');

/* Color propio de cada órgano: las mismas tablas TINT y ART_TINT de index.html (se leen de ahí para no duplicarlas) */
const HTML=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8');
const tabla=n=>{const i=HTML.indexOf('const '+n+'=['),j=HTML.indexOf('];',i);return (0,eval)(HTML.slice(i+('const '+n+'=').length,j+1));};
const TINT=tabla('TINT'),ART_TINT=tabla('ART_TINT');
const hexRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const COLOR_MUSCULO=hexRGB('#a3392f');
const esFem=k=>k.startsWith('f_')||SYS[k].sex==='f';
/* → [r,g,b,peso] en sRGB 0–255, o null si la pieza usa el color de su capa (tintFor de la web) */
function tinte(en,k){if(k==='insercion')return null;
  if(BS(k)==='articular'){for(const [re,col,w] of ART_TINT)if(re.test(en))return [...hexRGB(col),Math.round(w*255)];}
  if(BS(k)==='muscular'&&!/tendon/i.test(en)){let h=0;for(const ch of en)h=(h*31+ch.charCodeAt(0))|0;const f=0.88+((h>>>3)%100)/100*0.2,b=COLOR_MUSCULO;
    return [b[0]*f,b[1]*f*(0.97+((h>>>9)%7)/100),b[2]*f,255].map(v=>Math.round(Math.min(255,v)));}
  for(const [re,col,w,fo] of TINT)if((!fo||esFem(k))&&re.test(en))return [...hexRGB(col),Math.round(w*255)];
  return null;}

/* ───────── lectura de GLB (con o sin Draco) ───────── */
function mat4(n){if(n.matrix)return n.matrix.slice();const t=n.translation||[0,0,0],q=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];
  const [x,y,z,w]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return [(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,
          2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,t[0],t[1],t[2],1];}
function mul(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function leerGLB(buf,dm){
  const jl=buf.readUInt32LE(12),js=JSON.parse(buf.slice(20,20+jl).toString('utf8')),bo=20+jl+8;
  const acc=i=>{const a=js.accessors[i],bv=js.bufferViews[a.bufferView],T=CT[a.componentType],nc=NC[a.type],st=bv.byteStride||0,o0=bo+(bv.byteOffset||0)+(a.byteOffset||0);
    const out=new T(a.count*nc),bs=T.BYTES_PER_ELEMENT;
    const rd={1:(o)=>T===Int8Array?buf.readInt8(o):buf.readUInt8(o),2:(o)=>T===Int16Array?buf.readInt16LE(o):buf.readUInt16LE(o),4:(o)=>T===Float32Array?buf.readFloatLE(o):buf.readUInt32LE(o)}[bs];
    for(let i=0;i<a.count;i++)for(let c=0;c<nc;c++)out[i*nc+c]=rd(o0+i*(st||nc*bs)+c*bs);
    return {arr:out,nc,norm:!!a.normalized,T};};
  const dec=dm?new dm.Decoder():null,out=[];
  const prim=(pr)=>{const ex=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;let pos,idx,col=null,colNc=3,colScale=1;
    if(ex){const bv=js.bufferViews[ex.bufferView],db=new dm.DecoderBuffer();
      db.Init(new Int8Array(buf.buffer,buf.byteOffset+bo+(bv.byteOffset||0),bv.byteLength),bv.byteLength);
      const mesh=new dm.Mesh(),st=dec.DecodeBufferToMesh(db,mesh);if(!st.ok())throw new Error('Draco: '+st.error_msg());
      const nv=mesh.num_points(),nf=mesh.num_faces();
      const fa=new dm.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,dec.GetAttributeByUniqueId(mesh,ex.attributes.POSITION),fa);
      pos=new Float32Array(nv*3);for(let i=0;i<nv*3;i++)pos[i]=fa.GetValue(i);dm.destroy(fa);
      if(ex.attributes.COLOR_0!==undefined){const at=dec.GetAttributeByUniqueId(mesh,ex.attributes.COLOR_0);colNc=at.num_components();
        const a=js.accessors[pr.attributes.COLOR_0];
        if(a&&a.componentType===5126){const ca=new dm.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,at,ca);col=new Float32Array(nv*colNc);for(let i=0;i<col.length;i++)col[i]=ca.GetValue(i);dm.destroy(ca);colScale=255;}
        else{const ca=new dm.DracoUInt8Array();dec.GetAttributeUInt8ForAllPoints(mesh,at,ca);col=new Uint8Array(nv*colNc);for(let i=0;i<col.length;i++)col[i]=ca.GetValue(i);dm.destroy(ca);}}
      idx=new Uint32Array(nf*3);const ia=new dm.DracoInt32Array();
      for(let f=0;f<nf;f++){dec.GetFaceFromMesh(mesh,f,ia);idx[f*3]=ia.GetValue(0);idx[f*3+1]=ia.GetValue(1);idx[f*3+2]=ia.GetValue(2);}
      dm.destroy(ia);dm.destroy(mesh);dm.destroy(db);}
    else{if(pr.indices===undefined)return null;pos=new Float32Array(acc(pr.attributes.POSITION).arr);idx=new Uint32Array(acc(pr.indices).arr);
      if(pr.attributes.COLOR_0!==undefined){const c=acc(pr.attributes.COLOR_0);col=c.arr;colNc=c.nc;colScale=c.T===Float32Array?255:c.T===Uint16Array?255/65535:1;}}
    let c3=null;if(col){const n=pos.length/3;c3=new Uint8Array(n*3);for(let i=0;i<n;i++)for(let k=0;k<3;k++)c3[i*3+k]=Math.max(0,Math.min(255,Math.round(col[i*colNc+k]*colScale)));}
    return {pos,idx,col:c3};};
  const visit=(ni,M,pname)=>{const n=js.nodes[ni],W=mul(M,mat4(n));
    if(n.mesh!==undefined){const ps=js.meshes[n.mesh].primitives.map(prim).filter(Boolean);
      for(const g of ps){const p=g.pos;for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2];
        p[i]=W[0]*x+W[4]*y+W[8]*z+W[12];p[i+1]=W[1]*x+W[5]*y+W[9]*z+W[13];p[i+2]=W[2]*x+W[6]*y+W[10]*z+W[14];}
        out.push({name:n.name||js.meshes[n.mesh].name||'',parent:pname,...g});}}
    (n.children||[]).forEach(c=>visit(c,W,n.name||''));};
  const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  (js.scenes[js.scene||0].nodes).forEach(n=>visit(n,I,''));
  return out;}
const leerB64=(f,dm)=>leerGLB(Buffer.from(fs.readFileSync(path.join(RAIZ,f),'utf8').trim(),'base64'),dm);

/* ───────── mismas correcciones que la web ───────── */
function seamFix(file,name,arr){const f=SEAM[file],p=f&&f[name];if(!p||arr.length!==p.n*3)return;const D=p.d,DI=p.di,I=p.i;let v=0;
  for(let k=0,K=(DI||I).length;k<K;k++){v=DI?v+DI[k]:I[k];const j=v*3,q=k*3;arr[j]+=D[q]*1e-5;arr[j+1]+=D[q+1]*1e-5;arr[j+2]+=D[q+2]*1e-5;}}
function nuevosGeo(q){let pos,idx;
  if(typeof q.p==='string'){const sc=(NUEVOS.q||1)*1e-5,b=Buffer.from(q.p,'base64'),d=new Int16Array(b.buffer,b.byteOffset,b.length/2),n=d.length/3;pos=new Float32Array(d.length);let x=q.o[0],y=q.o[1],z=q.o[2];
    for(let v=0;v<n;v++){if(v){x+=d[v*3];y+=d[v*3+1];z+=d[v*3+2];}pos[v*3]=x*sc;pos[v*3+1]=y*sc;pos[v*3+2]=z*sc;}
    const bi=Buffer.from(q.i,'base64'),di=q.w===4?new Int32Array(bi.buffer,bi.byteOffset,bi.length/4):new Int16Array(bi.buffer,bi.byteOffset,bi.length/2);
    idx=new Uint32Array(di.length);let c=0;for(let k=0;k<di.length;k++){c+=di[k];idx[k]=c;}}
  else{pos=new Float32Array(q.p.length);for(let i=0;i<pos.length;i++)pos[i]=q.p[i]*1e-5;idx=new Uint32Array(q.i);}
  return {pos,idx,col:null};}
function normales(g){const p=g.pos,ix=g.idx,n=new Float32Array(p.length);
  for(let f=0;f<ix.length;f+=3){const a=ix[f]*3,b=ix[f+1]*3,c=ix[f+2]*3;
    const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    n[a]+=nx;n[a+1]+=ny;n[a+2]+=nz;n[b]+=nx;n[b+1]+=ny;n[b+2]+=nz;n[c]+=nx;n[c+1]+=ny;n[c+2]+=nz;}
  for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2]);if(l>1e-20){n[i]/=l;n[i+1]/=l;n[i+2]/=l;}else{n[i]=0;n[i+1]=1;n[i+2]=0;}}
  return n;}
/* fibras del músculo: eje principal y abanico hacia el extremo estrecho (addFiberDir de la web) */
function fibras(a){const n=a.length/3;let cx=0,cy=0,cz=0;for(let i=0;i<n;i++){cx+=a[i*3];cy+=a[i*3+1];cz+=a[i*3+2];}cx/=n;cy/=n;cz/=n;
  let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;const st=Math.max(1,n/3000|0);
  for(let i=0;i<n;i+=st){const x=a[i*3]-cx,y=a[i*3+1]-cy,z=a[i*3+2]-cz;xx+=x*x;xy+=x*y;xz+=x*z;yy+=y*y;yz+=y*z;zz+=z*z;}
  let v=[0.3,1,0.2];for(let k=0;k<25;k++){const w=[xx*v[0]+xy*v[1]+xz*v[2],xy*v[0]+yy*v[1]+yz*v[2],xz*v[0]+yz*v[1]+zz*v[2]];const l=Math.hypot(...w)||1;v=w.map(t=>t/l);}
  let tmin=1e9,tmax=-1e9;const t=new Float32Array(n);for(let i=0;i<n;i++){t[i]=(a[i*3]-cx)*v[0]+(a[i*3+1]-cy)*v[1]+(a[i*3+2]-cz)*v[2];if(t[i]<tmin)tmin=t[i];if(t[i]>tmax)tmax=t[i];}
  const L=tmax-tmin||1e-6,end=[[0,0,0,0,0],[0,0,0,0,0]];
  for(let i=0;i<n;i++){const u=(t[i]-tmin)/L;const e=u<0.1?0:u>0.9?1:-1;if(e<0)continue;const px=a[i*3],py=a[i*3+1],pz=a[i*3+2];const E=end[e];E[0]+=px;E[1]+=py;E[2]+=pz;E[3]++;
    E[4]+=Math.hypot(px-cx-t[i]*v[0],py-cy-t[i]*v[1],pz-cz-t[i]*v[2]);}
  const sp=end.map(E=>E[3]?E[4]/E[3]:1e9),k=sp[0]<sp[1]?0:1,E=end[k];const fan=E[3]&&Math.min(sp[0],sp[1])<0.6*Math.max(sp[0],sp[1]);
  const P=E[3]?[E[0]/E[3],E[1]/E[3],E[2]/E[3]]:[cx,cy,cz];
  const f=new Float32Array(n*3);for(let i=0;i<n;i++){let x=v[0],y=v[1],z=v[2];
    if(fan){const dx=P[0]-a[i*3],dy=P[1]-a[i*3+1],dz=P[2]-a[i*3+2],l=Math.hypot(dx,dy,dz);if(l>L*0.04){const sg=(dx*v[0]+dy*v[1]+dz*v[2])<0?-1:1;x=0.8*dx/l+0.2*v[0]*sg;y=0.8*dy/l+0.2*v[1]*sg;z=0.8*dz/l+0.2*v[2]*sg;}}
    f[i*3]=x;f[i*3+1]=y;f[i*3+2]=z;}
  return f;}
/* eje local de vasos y nervios: PCA por celdas de 2 cm, suavizada con las vecinas (addAxisDir de la web) */
function ejes(a){const n=a.length/3,C=0.02,cells=new Map(),ci=new Int32Array(n*3),key=(x,y,z)=>x+','+y+','+z;
  for(let i=0;i<n;i++){const x=Math.floor(a[i*3]/C),y=Math.floor(a[i*3+1]/C),z=Math.floor(a[i*3+2]/C);ci[i*3]=x;ci[i*3+1]=y;ci[i*3+2]=z;const k=key(x,y,z);
    let c=cells.get(k);if(!c){c={n:0,s:[0,0,0],q:[0,0,0,0,0,0]};cells.set(k,c);}c.n++;const px=a[i*3],py=a[i*3+1],pz=a[i*3+2];
    c.s[0]+=px;c.s[1]+=py;c.s[2]+=pz;c.q[0]+=px*px;c.q[1]+=px*py;c.q[2]+=px*pz;c.q[3]+=py*py;c.q[4]+=py*pz;c.q[5]+=pz*pz;}
  for(const c of cells.values()){const k=c.n,mx=c.s[0]/k,my=c.s[1]/k,mz=c.s[2]/k;const xx=c.q[0]/k-mx*mx,xy=c.q[1]/k-mx*my,xz=c.q[2]/k-mx*mz,yy=c.q[3]/k-my*my,yz=c.q[4]/k-my*mz,zz=c.q[5]/k-mz*mz;
    let v=[0.3,1,0.2];for(let t=0;t<16;t++){const w=[xx*v[0]+xy*v[1]+xz*v[2],xy*v[0]+yy*v[1]+yz*v[2],xz*v[0]+yz*v[1]+zz*v[2]];const l=Math.hypot(...w)||1;v=w.map(q=>q/l);}c.d=v;}
  const f=new Float32Array(n*3),memo=new Map();
  for(let i=0;i<n;i++){const x=ci[i*3],y=ci[i*3+1],z=ci[i*3+2],k0=key(x,y,z);let r=memo.get(k0);
    if(!r){const d0=cells.get(k0).d;r=[0,0,0];
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const c=cells.get(key(x+dx,y+dy,z+dz));if(!c)continue;
        const s=(c.d[0]*d0[0]+c.d[1]*d0[1]+c.d[2]*d0[2])<0?-1:1,w=c.n;r[0]+=s*w*c.d[0];r[1]+=s*w*c.d[1];r[2]+=s*w*c.d[2];}
      const l=Math.hypot(r[0],r[1],r[2])||1;r=[r[0]/l,r[1]/l,r[2]/l];memo.set(k0,r);}
    f[i*3]=r[0];f[i*3+1]=r[1];f[i*3+2]=r[2];}
  return f;}
/* tangente = dirección de fibra proyectada sobre la superficie (Gram-Schmidt contra la normal) */
function tangentes(dir,nrm){const n=nrm.length/3,t=new Float32Array(n*4);
  for(let i=0;i<n;i++){const nx=nrm[i*3],ny=nrm[i*3+1],nz=nrm[i*3+2];let x=dir[i*3],y=dir[i*3+1],z=dir[i*3+2];
    let d=x*nx+y*ny+z*nz;x-=d*nx;y-=d*ny;z-=d*nz;let l=Math.hypot(x,y,z);
    if(l<1e-4){/* fibra perpendicular a la superficie: cualquier tangente estable */const ax=Math.abs(nx)<0.9?[1,0,0]:[0,1,0];
      x=ny*ax[2]-nz*ax[1];y=nz*ax[0]-nx*ax[2];z=nx*ax[1]-ny*ax[0];l=Math.hypot(x,y,z)||1;}
    t[i*4]=x/l;t[i*4+1]=y/l;t[i*4+2]=z/l;t[i*4+3]=1;}
  return t;}

/* ───────── escritura de GLB ───────── */
function escribirGLB(archivo,piezas){
  const js={asset:{version:'2.0',generator:'Corpus Atlas → Unreal (tools/unreal/exportar.js)',
    copyright:'Z-Anatomy (CC BY-SA 4.0), BodyParts3D, HuBMAP Human Reference Atlas (CC BY 4.0). Véase ATTRIBUTION.md'},
    scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}],
    materials:[{name:'M_Corpus',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.6}}]};
  const trozos=[];let off=0;
  const vista=(ta,target)=>{const b=Buffer.from(ta.buffer,ta.byteOffset,ta.byteLength),pad=(4-b.length%4)%4;
    js.bufferViews.push({buffer:0,byteOffset:off,byteLength:b.length,target});trozos.push(b);if(pad)trozos.push(Buffer.alloc(pad));off+=b.length+pad;return js.bufferViews.length-1;};
  const ac=(bv,ct,count,type,extra)=>{js.accessors.push({bufferView:bv,componentType:ct,count,type,...extra});return js.accessors.length-1;};
  for(const p of piezas){const n=p.pos.length/3,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(let i=0;i<p.pos.length;i++){const c=i%3,v=p.pos[i];if(v<mn[c])mn[c]=v;if(v>mx[c])mx[c]=v;}
    const c4=new Uint8Array(n*4);for(let i=0;i<n;i++){c4[i*4]=p.col[i*3];c4[i*4+1]=p.col[i*3+1];c4[i*4+2]=p.col[i*3+2];c4[i*4+3]=255;}
    const at={POSITION:ac(vista(p.pos,34962),5126,n,'VEC3',{min:mn,max:mx}),NORMAL:ac(vista(p.nrm,34962),5126,n,'VEC3'),
      COLOR_0:ac(vista(c4,34962),5121,n,'VEC4',{normalized:true})};
    if(p.tan)at.TANGENT=ac(vista(p.tan,34962),5126,n,'VEC4');
    const ind=ac(vista(p.idx,34963),5125,p.idx.length,'SCALAR');
    js.meshes.push({name:p.id,primitives:[{attributes:at,indices:ind,material:0}]});
    js.nodes.push({name:p.id,mesh:js.meshes.length-1,extras:p.extras});js.scenes[0].nodes.push(js.nodes.length-1);}
  js.buffers[0].byteLength=off;
  let jb=Buffer.from(JSON.stringify(js),'utf8');if(jb.length%4)jb=Buffer.concat([jb,Buffer.alloc(4-jb.length%4,0x20)]);
  const cab=Buffer.alloc(12);cab.writeUInt32LE(0x46546C67,0);cab.writeUInt32LE(2,4);cab.writeUInt32LE(12+8+jb.length+8+off,8);
  const cj=Buffer.alloc(8);cj.writeUInt32LE(jb.length,0);cj.writeUInt32LE(0x4E4F534A,4);
  const cb=Buffer.alloc(8);cb.writeUInt32LE(off,0);cb.writeUInt32LE(0x004E4942,4);
  fs.mkdirSync(path.dirname(archivo),{recursive:true});
  const fd=fs.openSync(archivo,'w');for(const b of [cab,cj,jb,cb,...trozos])fs.writeSync(fd,b);fs.closeSync(fd);}

/* ───────── proceso ───────── */
const MAN={version:'',unidades:'metros, Y arriba (glTF); Unreal convierte a cm y Z arriba',color:'R oclusión · G tendón · B cartílago',archivos:[],piezas:{}};
function terminar(id,k,g,origen){
  const c=CAT[id]||[id,id,id,'',k,'',''];
  if(!g.col||g.col.length!==g.pos.length){g.col=new Uint8Array(g.pos.length);for(let i=0;i<g.col.length;i+=3)g.col[i]=235;}
  /* SOLO_COLOR (tendones.js --restaurar): basta la posición y el color tal como los da la web; sin normales ni tangentes */
  if(module.exports.SOLO_COLOR)return {id,pos:g.pos,idx:g.idx,col:g.col,origen,extras:{en:c[1],es:c[2],la:c[3],sistema:k,lado:c[5]||''}};
  g.nrm=normales(g);const b=BS(k);
  if(g.pos.length>=9){if(b==='muscular'||(b==='articular'&&LIGRX.test(c[1])))g.tan=tangentes(fibras(g.pos),g.nrm);else if(TUBOS.includes(b))g.tan=tangentes(ejes(g.pos),g.nrm);}
  return {id,pos:g.pos,idx:g.idx,col:g.col,nrm:g.nrm,tan:g.tan,origen,extras:{en:c[1],es:c[2],la:c[3],sistema:k,lado:c[5]||''}};}
function guardar(cuerpo,k,piezas){if(!piezas.length)return;const rel=cuerpo+'/'+k+'.glb';let tris=0;
  for(const p of piezas){tris+=p.idx.length/3;const n=p.pos.length/3,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(let i=0;i<p.pos.length;i++){const c=i%3,v=p.pos[i];if(v<mn[c])mn[c]=v;if(v>mx[c])mx[c]=v;}
    const r=v=>Math.round(v*1e5)/1e5;
    const tn=tinte(p.extras.en,k);
    (MAN.piezas[p.id]=MAN.piezas[p.id]||{})[cuerpo]={a:rel,s:k,t:p.idx.length/3,v:n,o:p.origen,...(tn?{k:tn}:{}),c:mn.map((v,i)=>r((v+mx[i])/2)),b:[mn.map(r),mx.map(r)]};}
  escribirGLB(path.join(SAL,rel),piezas);MAN.archivos.push({archivo:rel,cuerpo,sistema:k,base:BS(k),piezas:piezas.length,triangulos:tris});
  console.log(('  '+rel).padEnd(38),String(piezas.length).padStart(5),'piezas',String(tris).padStart(9),'triángulos');}

/* Geometrías que sustituyen a las de la capa ligera (alta resolución regional, corazón HRA, HRA v1.4) y piezas ocultas */
function fuentes(dm){
  /* alta resolución regional */
  const HRGEO={};
  for(const r of HRREG)for(const lv of ['loc','nv']){const f='hr/'+r+'_'+lv;if(!fs.existsSync(path.join(RAIZ,f+'.txt')))continue;
    for(const o of leerB64(f+'.txt',dm)){seamFix(f,o.name,o.pos);HRGEO[o.name]={g:o,o:'hr/'+r};}}
  /* corazón y grandes vasos HRA: las mallas llevan el nombre en inglés de la pieza */
  const porNombre={};for(const id in CAT)(porNombre[CAT[id][1]]=porNombre[CAT[id][1]]||[]).push(id);
  const oculto=new Set();
  if(fs.existsSync(path.join(RAIZ,'data/heart_hra.glb'))){
    for(const o of leerGLB(fs.readFileSync(path.join(RAIZ,'data/heart_hra.glb')),dm)){
      const ids=porNombre[o.name]||porNombre[o.name.replace(/_/g,' ')]||porNombre[(o.parent||'').replace(/_/g,' ')];if(!ids)continue;
      for(const id of ids)HRGEO[id]={g:o,o:'hra'};}
    for(const n of HRA_HIDE)for(const id of porNombre[n]||[])if(!(HRGEO[id]&&HRGEO[id].o==='hra'))oculto.add(id);}
  /* HRA v1.4 (ojo, cartílagos traqueales, tonsilas): mallas con el id del catálogo; sustituyen o añaden piezas */
  const HRA14={};
  if(fs.existsSync(path.join(RAIZ,'data/hra14.glb')))for(const o of leerGLB(fs.readFileSync(path.join(RAIZ,'data/hra14.glb')),dm)){
    const id=CAT[o.name]?o.name:(CAT[o.parent]?o.parent:null);if(id){HRA14[id]=o;HRGEO[id]={g:o,o:'hra14'};}}
  return {HRGEO,HRA14,oculto};}
const copia=g=>({pos:new Float32Array(g.pos),idx:g.idx,col:g.col?new Uint8Array(g.col):null});
/* Piezas de una capa del cuerpo base (hombre, o las capas solo de mujer), en el orden en que se escriben en su GLB */
function capaBase(dm,F,k){const {HRGEO,HRA14,oculto}=F,s=SYS[k];if(!s||s.sex==='vh'||!fs.existsSync(path.join(RAIZ,'m2/'+k+'.txt')))return null;
    const cuerpo=s.sex==='f'?'mujer':'hombre',P=[],visto=new Set();
    for(const o of leerB64('m2/'+k+'.txt',dm)){if(oculto.has(o.name)||visto.has(o.name))continue;visto.add(o.name);seamFix('m2/'+k,o.name,o.pos);
      const h=cuerpo==='hombre'&&HRGEO[o.name];P.push(terminar(o.name,k,h?copia(h.g):o,h?h.o:'m2'));}
    for(const q of NUEVOS[k]||[]){if(visto.has(q.id))continue;visto.add(q.id);P.push(terminar(q.id,k,nuevosGeo(q),'blender'));}
    if(cuerpo==='hombre')for(const id in HRA14){if(visto.has(id)||CAT[id][4]!==k)continue;visto.add(id);P.push(terminar(id,k,copia(HRA14[id]),'hra14'));}
    return {cuerpo,P};}
/* Piezas de una capa que cambian en el cuerpo de mujer */
function capaMujer(dm,k){const f='m2/'+k+'__f';if(!(FEM.ovr||[]).includes(k)||!fs.existsSync(path.join(RAIZ,f+'.txt')))return null;const P=[];
    for(const o of leerB64(f+'.txt',dm)){seamFix(f,o.name,o.pos);P.push(terminar(o.name,k,o,'m2__f'));}
    for(const q of NUEVOS[k]||[])if(q.f)P.push(terminar(q.id,k,nuevosGeo(q.f),'blender_f'));
    return P;}
const conDraco=fn=>require(path.join(RAIZ,'draco','draco_decoder.js'))({onModuleLoaded:fn});
module.exports={SYS,fuentes,capaBase,capaMujer,conDraco,SOLO_COLOR:false};

if(require.main===module)conDraco(dm=>{try{
  MAN.version=(fs.readFileSync(path.join(RAIZ,'sw.js'),'utf8').match(/corpus-v\d+/)||[''])[0];
  console.log('Corpus Atlas',MAN.version,'→',SAL);
  const F=fuentes(dm),oculto=F.oculto;

  console.log('Cuerpo de hombre');
  for(const k in SYS){const r=capaBase(dm,F,k);if(r)guardar(r.cuerpo,k,r.P);}

  console.log('Cuerpo de mujer (piezas que cambian respecto al hombre)');
  for(const k of FEM.ovr||[]){const P=capaMujer(dm,k);if(P)guardar('mujer',k,P);}

  console.log('Visible Human Female');
  for(const k in SYS){if(SYS[k].sex!=='vh'||!fs.existsSync(path.join(RAIZ,'m2/'+k+'.txt')))continue;
    guardar('vh',k,leerB64('m2/'+k+'.txt',dm).map(o=>terminar(o.name,k,o,'vh')));}

  MAN.solo_hombre=['x29','x30','x31','x32','x33','x34','x37','x38'];MAN.solo_mujer=FEM.fonly||[];MAN.corazon_oculto=[...oculto];
  fs.writeFileSync(path.join(SAL,'manifiesto.json'),JSON.stringify(MAN));
  const dd=path.join(SAL,'datos');fs.mkdirSync(dd,{recursive:true});let nd=0;
  for(const f of fs.readdirSync(path.join(RAIZ,'data')))if(f.endsWith('.json')){fs.copyFileSync(path.join(RAIZ,'data',f),path.join(dd,f));nd++;}
  const T=MAN.archivos.reduce((s,a)=>s+a.triangulos,0);
  console.log(`Listo: ${MAN.archivos.length} archivos GLB, ${Object.keys(MAN.piezas).length} piezas, ${T.toLocaleString('es')} triángulos, ${nd} archivos de datos.`);
  process.exit(0);
}catch(e){console.error(e);process.exit(1);}});
