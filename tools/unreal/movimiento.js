#!/usr/bin/env node
/* Corpus Atlas → Unreal: movimiento (rig, pesos de deformación y posturas de los rangos articulares).

   Uso:   python -m http.server 8765            (en la raíz del repositorio, en otra consola)
          node tools/unreal/exportar.js         (antes: crea los GLB)
          node tools/unreal/movimiento.js [url] [carpeta Importar]

   No reprograma el movimiento: abre la web en un navegador sin ventana (Playwright, con ?qa) y usa sus propias funciones.
   1. Pesos: para cada vértice de cada pieza del hombre y de la mujer, weightsFor() de la web da cuánto le mueve cada
      articulación (huesos rígidos por pieza, partes blandas con data/skinvox.json, tronco y cuello por altura y segmentos).
      Cada pieza usa como mucho 8 articulaciones («huecos»), en el orden en que las aplica deform() (de distal a
      proximal): la lista va en movimiento.json → piezas[cuerpo][id] como ± índice (negativo = interpolación lineal,
      u.lin de la web, que también es por pieza) y Unreal la pasa al material en los datos primitivos 12–19.
      En los GLB, TEXCOORD_0…3 llevan solo los 8 pesos (0–1) de esos huecos: Nanite y la malla de reserva promedian los
      UV al simplificar, y un peso promediado sigue siendo un peso (un «índice + peso» promediado daba otra articulación).
      Si torácica, tronco y lumbar pesan igual en toda la pieza van juntas en un hueco (AX).
   2. Posturas: para cada movimiento de la tabla ROM (cada 5°, lado derecho e izquierdo) se llama a applyPose() de la web
      con deform() interceptado; se guardan los giros resultantes (eje, ángulo, pivote y traslación de la rodilla), ya con
      el ritmo escapulohumeral, la escápula sobre las costillas, el deslizamiento de la rodilla y el tobillo separado en
      talocrural y subastragalina. Salida: <Importar>/datos/movimiento.json.
   Unreal aplica los giros en la GPU (M_CorpusTejido, World Position Offset) leyendo la postura de una textura de 32×4.

   Fuera por ahora (ver unreal/LEEME.md): dedos de la mano y del pie, y los ajustes finos posteriores de la web
   (musPost, latHug, kneePush, fibras del pectoral). */
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Falta Playwright: npm i playwright (o NODE_PATH a una instalación existente)'); process.exit(1); }

const RAIZ = path.resolve(__dirname, '..', '..');
const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));   // --sin-pesos: solo posturas (no toca los GLB)
const URL = ARGS[0] || 'http://localhost:8765/index.html';
const IMP = path.resolve(ARGS[1] || path.join(RAIZ, 'unreal', 'CorpusAtlas', 'Importar'));
const CUERPOS = ['hombre', 'mujer'];            // el Visible Human no se mueve en la web
const ROM_FUERA = ['dedos', 'pulgar', 'dedospie'];
const PASO = 5;

/* ───────── GLB ───────── */
function leeGLB(f) {
  const b = fs.readFileSync(f);
  const lj = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + lj).toString('utf8'));
  const o = 20 + lj, lb = b.readUInt32LE(o), bin = b.slice(o + 8, o + 8 + lb);
  return { j, bin };
}
function vista(g, acc) {
  const a = g.j.accessors[acc], v = g.j.bufferViews[a.bufferView];
  if (a.componentType !== 5126) throw new Error('accesor no float');
  const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], st = (v.byteStride || nc * 4) / 4;
  const base = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * nc);
  const f = new Float32Array(g.bin.buffer, g.bin.byteOffset, g.bin.length >> 2);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < nc; c++) out[i * nc + c] = f[(base >> 2) + i * st + c];
  return out;
}
function indices(g, acc) {
  const a = g.j.accessors[acc], v = g.j.bufferViews[a.bufferView], o = g.bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
  if (a.componentType === 5125) return new Uint32Array(g.bin.buffer.slice(o, o + a.count * 4));
  if (a.componentType === 5123) return new Uint16Array(g.bin.buffer.slice(o, o + a.count * 2));
  return new Uint8Array(g.bin.buffer.slice(o, o + a.count));
}
/* escribe el GLB con los TEXCOORD nuevos; el BIN se rehace solo con las vistas que se usan */
function escribeGLB(f, g, nuevos) {
  const j = g.j, partes = [];
  let off = 0;
  const pon = buf => { const o = off; partes.push(buf); off += buf.length; const pad = (4 - (off % 4)) % 4; if (pad) { partes.push(Buffer.alloc(pad)); off += pad; } return o; };
  const vistas = [], mapa = new Map();
  const usa = i => { if (mapa.has(i)) return mapa.get(i); const v = j.bufferViews[i];
    const o = pon(g.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); const nv = Object.assign({}, v, { byteOffset: o });
    vistas.push(nv); mapa.set(i, vistas.length - 1); return vistas.length - 1; };
  for (const a of j.accessors) if (a.bufferView !== undefined) a.bufferView = usa(a.bufferView);
  for (const [prim, datos] of nuevos) {
    for (let c = 0; c < 4; c++) {
      const n = datos.length / 8, uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { uv[i * 2] = datos[i * 8 + c * 2]; uv[i * 2 + 1] = datos[i * 8 + c * 2 + 1]; }
      const o = pon(Buffer.from(uv.buffer));
      vistas.push({ buffer: 0, byteOffset: o, byteLength: uv.byteLength });
      j.accessors.push({ bufferView: vistas.length - 1, componentType: 5126, count: n, type: 'VEC2' });
      prim.attributes['TEXCOORD_' + c] = j.accessors.length - 1;
    }
  }
  j.bufferViews = vistas;
  const bin = Buffer.concat(partes);
  j.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(j), 'utf8'); const pj = (4 - (js.length % 4)) % 4; if (pj) js = Buffer.concat([js, Buffer.alloc(pj, 0x20)]);
  const h = Buffer.alloc(12); h.write('glTF', 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(js.length, 0); cj.writeUInt32LE(0x4E4F534A, 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(bin.length, 0); cb.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(f, Buffer.concat([h, cj, js, cb, bin]));
}

/* ───────── código que corre dentro de la web (ámbito del módulo, vía __qa.ev) ───────── */
const PREPARA = `(async()=>{
  if(!SKIN){const j=await (await fetch('data/skinvox.json')).json();for(const F of j.f){F.jj={};for(const k in F.j){const b=atob(F.j[k]),a=new Uint8Array(b.length);for(let t=0;t<b.length;t++)a[t]=b.charCodeAt(t);F.jj[k]=a;}delete F.j;}SKIN=j;}
  const dep=k=>DEPTH[k.split('_')[0]]||0;
  let L=[];for(const k of Object.keys(JOINTS)){if(k==='__root'||/^(mcp|pip|dip|cmc|ip|mtp)\\d*_/.test(k))continue;
    if(/^ankle_/.test(k))L.push('ankle_st_'+k.slice(6),'ankle_tc_'+k.slice(6));else L.push(k);}
  L=L.map((k,i)=>({k,i,d:dep(k)})).sort((a,b)=>b.d-a.d||a.i-b.i).map(x=>x.k);
  const AXK=L.slice(-3);if(AXK.slice().sort().join()!=='lumb,thor,trunk')throw new Error('las tres últimas no son el tronco: '+AXK);
  const jn=k=>k.replace(/^ankle_(st|tc)_/,'ankle_');
  const piv=k=>{if(/^ankle_st_/.test(k)){const J=JOINTS[jn(k)];return ankleSplit({jn:jn(k),ang:0.1,ax:new V3(1,0,0),p:J.pivot,tr:null}).sw.p;}return JOINTS[jn(k)].pivot;};
  const b64e=u8=>{if(u8.toBase64)return u8.toBase64();let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);};
  const b64d=s=>{if(Uint8Array.fromBase64)return Uint8Array.fromBase64(s);const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;};
  const AX=L.length+1,NA=L.length;
  const HARM=/^((Ascending|Descending|Transverse) part of trapezius|Rhomboid (major|minor)|Levator scapulae|Serratus anterior|Pectoralis minor|Subclavius|(Clavicular|Acromial|Scapular spinal) part of deltoid|Supraspinatus|Infraspinatus|Teres minor|Subscapularis)( muscle)?$/;
  window.__movW=(en,side,sys,b64,b64i)=>{const u8=b64d(b64),pos=new Float32Array(u8.buffer,u8.byteOffset,u8.length>>2),n=pos.length/3;const i8=b64i?b64d(b64i):null,idx=i8?new Uint32Array(i8.buffer,i8.byteOffset,i8.length>>2):null;
    let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;for(let i=0;i<n;i++){const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;}
    const c=new V3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);let r=0;for(let i=0;i<n;i++)r=Math.max(r,Math.hypot(pos[i*3]-c.x,pos[i*3+1]-c.y,pos[i*3+2]-c.z));
    const m={userData:{c:{en,side},sys},geometry:{attributes:{position:{array:pos}},boundingSphere:{center:c,radius:r},index:null}};
    const Ws=L.map(k=>{let W=null;try{W=weightsFor(m,jn(k));}catch(e){W=null;}if(/^ankle_st_/.test(k)&&en==='Talus')W=null;return [W,!!(m.userData.lin&&m.userData.lin[jn(k)])];});
    /* Dorsal ancho, pectoral mayor y redondo mayor (mejora sobre la web): sus pesos de hombro van a escalones (sectores angulares de shRig) y dejan que
       medio vientre muscular gire con el brazo; la web lo arregla después relajando la malla en la CPU. Aquí: solo los
       últimos centímetros junto al tendón siguen al húmero (la inserción está a ~6 cm de la articulación), el vientre
       queda sobre el tórax y el músculo se estira entre ambos. Peso suave por distancia al punto de inserción. */
    const TD=[[/^Latissimus dorsi muscle$/,/^(shoulder|acr|sc)$/,0.02,0.09],[/^(Sternocostal head|Abdominal part) of pectoralis major muscle$/,/^(shoulder|acr|sc)$/,0.03,0.11],
      [/^Clavicular head of pectoralis major muscle$/,/^(shoulder|acr)$/,0.03,0.09],[/^Teres major muscle$/,/^shoulder$/,0.02,0.07]].find(x=>x[0].test(en));
    if(TD&&(side==='derecho'||side==='izquierdo')){const Sd=side==='derecho'?'R':'L',seg=SEGS['arm_'+Sd],A=seg[0],B=seg[1],ax=B.x-A.x,ay=B.y-A.y,az=B.z-A.z,L2=ax*ax+ay*ay+az*az;
      let bi=0,bd=1e9;for(let i=0;i<n;i++){const px=pos[i*3]-A.x,py=pos[i*3+1]-A.y,pz=pos[i*3+2]-A.z;let t=(px*ax+py*ay+pz*az)/L2;t=t<0?0:t>1?1:t;const dx=px-ax*t,dy=py-ay*t,dz=pz-az*t,d=dx*dx+dy*dy+dz*dz+(t<0.06?0.0004:0);if(d<bd){bd=d;bi=i;}}
      const Ix=pos[bi*3],Iy=pos[bi*3+1],Iz=pos[bi*3+2],Wd=new Float32Array(n);
      for(let i=0;i<n;i++){let t=(Math.hypot(pos[i*3]-Ix,pos[i*3+1]-Iy,pos[i*3+2]-Iz)-TD[2])/TD[3];t=t<0?0:t>1?1:t;Wd[i]=1-t*t*(3-2*t);}
      L.forEach((k,q)=>{const [nd,sd]=k.split('_');if(sd===Sd&&TD[1].test(nd))Ws[q]=[Wd,true];else if(/^(elbow|fore|wrist|hip|knee)$/.test(nd)||(sd&&sd!==Sd&&/^(shoulder|acr|sc)$/.test(nd)))Ws[q]=[null,false];});}
    /* Músculos tendidos entre dos huesos de la cintura escapular (mejora sobre la web, donde el trapecio, los romboides o
       el serrato no acompañan a la escápula y lo que hay debajo los atraviesa). Cada músculo queda anclado a sus huesos:
       donde toca la escápula va con ella, donde toca vértebras o costillas se queda, donde toca el húmero va con él.
       Entre los anclajes el peso es armónico (ecuación de Laplace sobre la malla): el estiramiento se reparte de forma
       continua por toda la fibra, sin escalones ni zonas rígidas. */
    if(idx&&HARM.test(en)&&(side==='derecho'||side==='izquierdo')){const Sd=side==='derecho'?'R':'L';
      if(!window.__huesos){const cs=0.012,H=new Map();for(const b of meshes){const u=b.userData;if(!u.c||BS(u.sys)!=='oseo'||u.sys!=='oseo')continue;const part=skPartOf(b),a=u.rest||b.geometry.attributes.position.array;
          for(let i=0;i<a.length;i+=3){const k=Math.floor(a[i]/cs)+','+Math.floor(a[i+1]/cs)+','+Math.floor(a[i+2]/cs);let l=H.get(k);if(!l)H.set(k,l=[]);l.push(a[i],a[i+1],a[i+2],part);}}window.__huesos={cs,H};}
      const {cs,H}=window.__huesos,RA=0.012,ESC=/trapezius|Rhomboid|Levator scapulae|Serratus anterior|Pectoralis minor|Subclavius/.test(en);/* ESC: unen tórax y escápula, no llegan al húmero */
      /* vértices soldados por posición y vecinos */
      const uid=new Int32Array(n),M=new Map();let nu=0;for(let v=0;v<n;v++){const k=Math.round(pos[v*3]*2e4)+','+Math.round(pos[v*3+1]*2e4)+','+Math.round(pos[v*3+2]*2e4);let q=M.get(k);if(q===undefined){q=nu++;M.set(k,q);}uid[v]=q;}
      const rep=new Int32Array(nu).fill(-1);for(let v=0;v<n;v++)if(rep[uid[v]]<0)rep[uid[v]]=v;
      const nb=Array.from({length:nu},()=>new Set());for(let t=0;t<idx.length;t+=3){const a=uid[idx[t]],b=uid[idx[t+1]],c=uid[idx[t+2]];if(a!==b){nb[a].add(b);nb[b].add(a);}if(b!==c){nb[b].add(c);nb[c].add(b);}if(a!==c){nb[a].add(c);nb[c].add(a);}}
      const NB=nb.map(s=>Int32Array.from(s));
      /* hueso más cercano a cada vértice (a menos de 12 mm) */
      const ancla=new Array(nu).fill(null);for(let q=0;q<nu;q++){const v=rep[q],x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2],fx=Math.floor(x/cs),fy=Math.floor(y/cs),fz=Math.floor(z/cs);let bd=RA*RA,bp=null;
        for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){const l=H.get((fx+a)+','+(fy+b)+','+(fz+c));if(!l)continue;for(let t=0;t<l.length;t+=4){const d=(l[t]-x)**2+(l[t+1]-y)**2+(l[t+2]-z)**2;if(d<bd){bd=d;bp=l[t+3];}}}ancla[q]=bp;}
      for(const nodo of ['shoulder','acr','sc']){const kq=L.indexOf(nodo+'_'+Sd);if(kq<0)continue;if(ESC&&nodo==='shoulder'){Ws[kq]=[null,false];continue;}const W0=Ws[kq][0];
        const fijo=new Float32Array(nu).fill(-1);let n0=0,n1=0;for(let q=0;q<nu;q++){if(ancla[q]===null)continue;const f=skF(ancla[q],nodo,Sd)>0?1:0;fijo[q]=f;if(f)n1++;else n0++;}
        if(n0<4||n1<4)continue;/* sin dos anclajes distintos se dejan los pesos de la web */
        const x=new Float32Array(nu);for(let q=0;q<nu;q++)x[q]=fijo[q]>=0?fijo[q]:(W0?Math.min(1,W0[rep[q]]):0.5);
        for(let it=0;it<1500;it++){let dmax=0;for(let q=0;q<nu;q++){if(fijo[q]>=0)continue;const l=NB[q];if(!l.length)continue;let s=0;for(let t=0;t<l.length;t++)s+=x[l[t]];const nv=s/l.length,d=Math.abs(nv-x[q]);if(d>dmax)dmax=d;x[q]=nv;}if(dmax<2e-5)break;}
        const Wn=new Float32Array(n);for(let v=0;v<n;v++)Wn[v]=x[uid[v]];Ws[kq]=[Wn,true];}
      /* los que se insertan en la escapula la siguen igual en sus dos articulaciones (acromioclavicular y esternoclavicular) */
      if(ESC&&!/Subclavius|Descending/.test(en)){const qa=L.indexOf('acr_'+Sd),qs=L.indexOf('sc_'+Sd);if(Ws[qs][0]&&!Ws[qa][0])Ws[qa]=[Ws[qs][0],Ws[qs][1]];}
      L.forEach((k,q)=>{const [nd,sd]=k.split('_');if(/^(elbow|fore|wrist|hip|knee)$/.test(nd)||(sd&&sd!==Sd&&/^(shoulder|acr|sc)$/.test(nd)))Ws[q]=[null,false];});}
    /* articulaciones que mueven la pieza (algún vértice con peso ≥ 0,002), en el orden en que las aplica deform() */
    let S=[];for(let k=0;k<NA;k++){const W=Ws[k][0];if(!W)continue;let mx=0;for(let v=0;v<n;v++)if(W[v]>mx)mx=W[v];if(mx>=0.002)S.push({i:k+1,W,lin:Ws[k][1],mx});}
    /* articulaciones seguidas (en este orden) que pesan lo mismo en toda la pieza van juntas en un hueco, hasta 3:
       índice a + 32·b + 1024·c (p. ej. torácica, tronco y lumbar; o escápula y clavícula en el brazo) */
    const igual=(A,B)=>{for(let v=0;v<n;v++)if(Math.abs(A[v]-B[v])>=0.01)return false;return true;};
    const G=[];for(const s of S){const g=G[G.length-1];if(g&&g.js.length<3&&g.lin===s.lin&&igual(g.W,s.W)){g.js.push(s.i);g.mx=Math.max(g.mx,s.mx);}else G.push({js:[s.i],W:s.W,lin:s.lin,mx:s.mx});}
    S=G.map(g=>({i:g.js[0]+32*(g.js[1]||0)+1024*(g.js[2]||0),W:g.W,lin:g.lin,mx:g.mx,o:g.js[0]}));
    let over=0;if(S.length>8){over=S.length-8;S.sort((a,b)=>b.mx-a.mx);S.length=8;S.sort((a,b)=>a.o-b.o);}
    /* por vértice solo pesos (0–1): Nanite y la malla de reserva promedian los UV al simplificar, y un peso promediado sigue siendo un peso */
    const out=new Float32Array(n*8);for(let s=0;s<S.length;s++){const W=S[s].W;for(let v=0;v<n;v++)out[v*8+s]=W[v]>1?1:W[v]<0.002?0:W[v];}
    return {w:S.length?b64e(new Uint8Array(out.buffer)):'',huecos:S.map(s=>(s.lin?-1:1)*s.i),over,moved:S.length>0};};
  window.__movPose=(jid,mi,S,t)=>{const j=ROM.find(x=>x.id===jid);curJ=j;curM=j.moves[mi];romSide=S;angle=t;
    const tab=currentTab;currentTab='mov';let cap=null;const D0=deform;deform=a=>{cap=a;};
    try{applyPose();}finally{deform=D0;currentTab=tab;}
    const act=(cap||[]).map(a=>{if(a.tr||!/^knee_/.test(a.jn))return a;const tt=kneeTr(a.q,a.jn);return tt?Object.assign({},a,{tr:tt}):a;});
    const ops=act.map(a=>{const q=a.q;let ang=2*Math.acos(Math.min(1,Math.abs(q.w)));const s=Math.sqrt(Math.max(0,1-q.w*q.w));
      let ax=s>1e-6?new V3(q.x/s,q.y/s,q.z/s):new V3(1,0,0);if(q.w<0)ax.negate();return {jn:a.jn,ang,ax,p:JOINTS[a.jn].pivot,tr:a.tr?a.tr.clone().applyQuaternion(a.q):null};}).filter(o=>o.ang>1e-4||o.tr);
    const R=[],fuera=[];const pon=(k,o)=>{const i=L.indexOf(k);if(i<0){fuera.push(k);return;}const f=v=>Math.round(v*1e5)/1e5;
      R.push([i,f(o.ax.x),f(o.ax.y),f(o.ax.z),f(o.ang),o.tr?f(o.tr.x):0,o.tr?f(o.tr.y):0,o.tr?f(o.tr.z):0]);};
    for(const o of ops){if(/^ankle_/.test(o.jn)){const sp=ankleSplit(o),S2=o.jn.slice(6);pon('ankle_st_'+S2,sp.sw);pon('ankle_tc_'+S2,sp.tw);}else pon(o.jn,o);}
    R.sort((a,b)=>a[0]-b[0]);return {R,fuera};};
  return {L,AX,piv:L.map(k=>{const p=piv(k);return [p.x,p.y,p.z].map(v=>Math.round(v*1e5)/1e5);}),
    rom:ROM.filter(j=>!${JSON.stringify(ROM_FUERA)}.includes(j.id)).map(j=>({id:j.id,n:j.n,sided:!!j.sided,moves:j.moves.map(m=>({n:m.n,max:m.max,ax:m.ax,ag:m.ag||[]}))}))};
})()`;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
  const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  p.on('pageerror', e => console.log('error en la web:', e.message));
  const E = (c, ...a) => p.evaluate(([c, a]) => { const r = __qa.ev(c); return typeof r === 'function' ? r(...a) : r; }, [c, a]);
  console.log('Abriendo', URL + '?qa');
  await p.goto(URL + '?qa');
  await p.waitForFunction(() => window.__qa && __qa.ready && __qa.ev('SYS.oseo.state') === 'loaded', null, { timeout: 300000 });
  const R = await E(PREPARA);
  console.log('Articulaciones (%d, AX=%d): %s', R.L.length, R.AX, R.L.join(' '));

  /* ── posturas ── */
  const rom = [];
  for (const j of R.rom) {
    const movs = [];
    for (let mi = 0; mi < j.moves.length; mi++) {
      const m = j.moves[mi], lados = (j.sided || m.ax !== 'x') ? ['R', 'L'] : ['R'], M = { n: m.n, max: m.max, paso: PASO, ag: m.ag };
      for (const S of lados) {
        const fr = [];
        for (let t = 0; t <= m.max + 1e-6; t += PASO) {
          const r = await E('(j,mi,S,t)=>__movPose(j,mi,S,t)', j.id, mi, S, Math.min(t, m.max));
          if (r.fuera.length) console.log('  aviso: %s/%s fuera del rig: %s', j.id, m.n, [...new Set(r.fuera)].join(','));
          fr.push(r.R.flat());
        }
        if (m.max % PASO) { const r = await E('(j,mi,S,t)=>__movPose(j,mi,S,t)', j.id, mi, S, m.max); fr.push(r.R.flat()); }
        M[S] = fr;
      }
      movs.push(M);
    }
    rom.push({ id: j.id, n: j.n, lados: j.sided, movs });
    console.log('  ROM %s: %d movimientos', j.id, movs.length);
  }
  /* ── mejora sobre la web: la columna toracolumbar no gira en una sola bisagra ──
     En la web todo el giro de «tronco» ocurre en L3 y la zona lumbar hace joroba. Aquí se reparte entre la charnela
     lumbosacra (lumb, S1), L3 (trunk) y la toracolumbar (thor, T12), con el reparto fisiológico de cada movimiento:
     la flexión es sobre todo lumbar; la rotación, casi toda torácica (las carillas lumbares la bloquean). */
  const REPARTO = [[0.42, 0.26, 0.32], [0.45, 0.25, 0.30], [0.30, 0.28, 0.42], [0.08, 0.17, 0.75]];   // flexión, extensión, inclinación, rotación → [lumb, trunk, thor]
  const iL = R.L.indexOf('lumb'), iT = R.L.indexOf('trunk'), iH = R.L.indexOf('thor');
  const tronco = rom.find(r => r.id === 'tronco');
  if (tronco) tronco.movs.forEach((M, mi) => { const rp = REPARTO[mi] || REPARTO[0];
    for (const S of ['R', 'L']) if (M[S]) M[S] = M[S].map(fr => { const out = [];
      for (let k = 0; k < fr.length; k += 8) { const o = fr.slice(k, k + 8);
        if (o[0] !== iT) { out.push(o); continue; }
        [[iL, rp[0]], [iT, rp[1]], [iH, rp[2]]].forEach(([i, f]) => out.push([i, o[1], o[2], o[3], Math.round(o[4] * f * 1e5) / 1e5, 0, 0, 0])); }
      return out.sort((a, b) => a[0] - b[0]).flat(); }); });

  /* ── contorno de la parrilla costal por alturas (para pegar el dorsal ancho al tórax, como latHug de la web) ──
     Cada centímetro de altura: elipse que envuelve costillas, cartílagos, esternón y vértebras torácicas
     [centro z, radio x, radio z]. El material mide con ella cuánto se separa un punto de la pared torácica. */
  const torax = (() => { const g = leeGLB(path.join(IMP, 'hombre', 'oseo.glb')), y0 = 1.06, dy = 0.0125, n = 32;
    const caja = Array.from({ length: n }, () => [1e9, -1e9, 1e9, -1e9]);
    for (const nodo of g.j.nodes) { if (nodo.mesh === undefined || !/\brib\b|^Costal cartilage|sternum|Xiphoid|^Vertebra T\d+/i.test((nodo.extras || {}).en || '')) continue;
      const P = vista(g, g.j.meshes[nodo.mesh].primitives[0].attributes.POSITION);
      for (let i = 0; i < P.length; i += 3) { const k = Math.round((P[i + 1] - y0) / dy); if (k < 0 || k >= n) continue; const c = caja[k];
        if (P[i] < c[0]) c[0] = P[i]; if (P[i] > c[1]) c[1] = P[i]; if (P[i + 2] < c[2]) c[2] = P[i + 2]; if (P[i + 2] > c[3]) c[3] = P[i + 2]; } }
    const f = v => Math.round(v * 1e4) / 1e4;
    /* la caja se suaviza con sus vecinas: las costillas dejan huecos entre una y otra */
    const filas = caja.map((c, k) => { let a = [0, 0, 0, 0], m = 0; for (let d = -2; d <= 2; d++) { const q = caja[k + d]; if (!q || q[0] > q[1]) continue; for (let t = 0; t < 4; t++) a[t] += q[t]; m++; }
      if (!m) return [0, 0, 0]; a = a.map(v => v / m); return [f((a[2] + a[3]) / 2), f((a[1] - a[0]) / 2), f((a[3] - a[2]) / 2)]; });
    return { y0, dy, filas }; })();
  /* ── mejora sobre la web: la escápula resbala pegada a las costillas ──
     Con las posturas de la web, al rotar hacia arriba el ángulo inferior de la escápula se despega varios centímetros de
     la parrilla costal (asoma por la espalda). Aquí se añade a la acromioclavicular el giro mínimo, alrededor del eje
     perpendicular al brazo de palanca acromion → ángulo inferior, que devuelve el ángulo a su distancia de reposo del
     contorno del tórax; la glenohumeral se recalcula para que el húmero quede exactamente donde estaba. */
  {
    const rig = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'rig.json'), 'utf8'));
    const qAA = (ax, an) => { const s = Math.sin(an / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(an / 2)]; };
    const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    const qInv = q => [-q[0], -q[1], -q[2], q[3]];
    const qRot = (q, v) => { const u = [q[0], q[1], q[2]], c1 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]].map(x => 2 * x);
      const c2 = [u[1] * c1[2] - u[2] * c1[1], u[2] * c1[0] - u[0] * c1[2], u[0] * c1[1] - u[1] * c1[0]]; return v.map((x, i) => x + q[3] * c1[i] + c2[i]); };
    const aAA = q => { if (q[3] < 0) q = q.map(x => -x); const an = 2 * Math.acos(Math.min(1, q[3])), s = Math.sqrt(Math.max(0, 1 - q[3] * q[3])); return s > 1e-6 ? [q[0] / s, q[1] / s, q[2] / s, an] : [1, 0, 0, 0]; };
    const cont = y => { const h = Math.max(0, Math.min(torax.filas.length - 1.001, (y - torax.y0) / torax.dy)), a = Math.floor(h), f = h - a, A = torax.filas[a], B = torax.filas[a + 1]; return A.map((v, i) => v + (B[i] - v) * f); };
    const kDe = p => { const c = cont(p[1]); return [Math.hypot(p[0] / c[1], (p[2] - c[0]) / c[2]), c]; };
    const sobre = (p, piv, q) => qRot(q, p.map((x, i) => x - piv[i])).map((x, i) => x + piv[i]);
    let nfix = 0, amax = 0;
    for (const r of rom) for (const M of r.movs) for (const S of ['R', 'L']) { if (!M[S]) continue;
      const iA = R.L.indexOf('acr_' + S), iC = R.L.indexOf('sc_' + S), iH = R.L.indexOf('shoulder_' + S), pA = R.piv[iA], pC = R.piv[iC], tip0 = rig['scapBot_' + S], k0 = kDe(tip0)[0];
      M[S] = M[S].map(fr => { const ops = []; for (let k = 0; k < fr.length; k += 8) ops.push(fr.slice(k, k + 8));
        const oA = ops.find(o => o[0] === iA); if (!oA) return fr;
        const oC = ops.find(o => o[0] === iC), oH = ops.find(o => o[0] === iH);
        const qA = qAA(oA.slice(1, 4), oA[4]), qC = oC ? qAA(oC.slice(1, 4), oC[4]) : [0, 0, 0, 1];
        const tipA = sobre(tip0, pA, qA), fin = q => sobre(sobre(tip0, pA, q), pC, qC);
        const [k1, c] = kDe(fin(qA)), tol = 0.004 / (0.5 * (c[1] + c[2]));
        if (k1 <= k0 + tol) return fr;
        /* eje: perpendicular a la palanca y a la normal de la pared torácica, llevado al marco anterior a la esternoclavicular */
        const t = fin(qA), nrm = [t[0] / (c[1] * c[1]), 0, (t[2] - c[0]) / (c[2] * c[2])], v = t.map((x, i) => x - sobre(pA, pC, qC)[i]);
        let eje = [v[1] * nrm[2] - v[2] * nrm[1], v[2] * nrm[0] - v[0] * nrm[2], v[0] * nrm[1] - v[1] * nrm[0]]; const le = Math.hypot(...eje); if (le < 1e-9) return fr; eje = qRot(qInv(qC), eje.map(x => x / le));
        const kCon = an => kDe(fin(qMul(qAA(eje, an), qA)))[0];
        /* el signo que acerca, y bisección hasta la distancia de reposo */
        const sg = kCon(0.05) < kCon(-0.05) ? 1 : -1; let lo = 0, hi = 0.7;
        if (kCon(sg * hi) > k0 + tol) lo = hi; else for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (kCon(sg * m) > k0 + tol) lo = m; else hi = m; }
        const an = sg * (lo === 0.7 ? 0.7 : hi), qA2 = qMul(qAA(eje, an), qA); nfix++; amax = Math.max(amax, Math.abs(an));
        const f5 = x => Math.round(x * 1e5) / 1e5, a2 = aAA(qA2);
        oA[1] = f5(a2[0]); oA[2] = f5(a2[1]); oA[3] = f5(a2[2]); oA[4] = f5(a2[3]);
        if (oH) { const qH = qAA(oH.slice(1, 4), oH[4]), h2 = aAA(qMul(qInv(qA2), qMul(qA, qH))); oH[1] = f5(h2[0]); oH[2] = f5(h2[1]); oH[3] = f5(h2[2]); oH[4] = f5(h2[3]); }
        return ops.flat(); }); }
    console.log('Escápula sobre las costillas: %d posturas corregidas, giro añadido máximo %s°', nfix, (amax * 57.2958).toFixed(1));
  }
  const abrazo = {};
  for (const c of CUERPOS) { const g = leeGLB(path.join(IMP, c, 'muscular.glb'));
    abrazo[c] = g.j.nodes.filter(nd => /^(Latissimus dorsi muscle|Teres major muscle|.* of pectoralis major muscle)$/.test((nd.extras || {}).en || '')).map(nd => nd.name); }

  const SIN_PESOS = process.argv.includes('--sin-pesos');
  const SOLO = (process.argv.find(a => a.startsWith('--solo=')) || '').slice(7);   // --solo=muscular: rehace los pesos de esa capa nada más
  const jf = path.join(IMP, 'datos', 'movimiento.json');
  const antes = (SIN_PESOS || SOLO) && fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : null;
  const salida = { version: 2, unidades: 'm, glTF (Y arriba)', paso: PASO, ax: R.AX, ax_de: R.L.slice(-3),
    articulaciones: R.L.map((k, i) => ({ id: k, pivote: R.piv[i] })), rom, torax, abrazo, piezas: antes ? antes.piezas : {} };
  fs.mkdirSync(path.join(IMP, 'datos'), { recursive: true });
  fs.writeFileSync(jf, JSON.stringify(salida));
  console.log('Posturas: datos/movimiento.json');
  if (SIN_PESOS) { console.log('Pesos: sin tocar (--sin-pesos)'); await b.close(); return; }

  /* ── pesos ── */
  let tv = 0, tm = 0, to = 0;
  if (!SOLO) salida.piezas = {};
  for (const c of CUERPOS) {
    const P = salida.piezas[c] = salida.piezas[c] || {};
    const dir = path.join(IMP, c);
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.glb') && (!SOLO || x === SOLO + '.glb'))) {
      const g = leeGLB(path.join(dir, f)), nuevos = [];
      let mv = 0, ov = 0, nv = 0;
      for (let ni = 0; ni < g.j.nodes.length; ni++) {
        const nodo = g.j.nodes[ni]; if (nodo.mesh === undefined) continue;
        if (nodo.matrix || nodo.translation || nodo.rotation || nodo.scale) throw new Error('nodo con transformación en ' + f);
        const ex = nodo.extras || {}, sys = ex.sistema || f.replace('.glb', '');
        for (const prim of g.j.meshes[nodo.mesh].primitives) {
          const pos = vista(g, prim.attributes.POSITION), n = pos.length / 3;
          for (const k of Object.keys(prim.attributes)) if (/^TEXCOORD_/.test(k)) delete prim.attributes[k];
          const ind = f === 'muscular.glb' ? Buffer.from(Uint32Array.from(indices(g, prim.indices)).buffer).toString('base64') : '';
          const r = await E('(en,side,sys,b,bi)=>__movW(en,side,sys,b,bi)', ex.en || '', ex.lado || '', sys, Buffer.from(pos.buffer).toString('base64'), ind);
          const w = r.w ? new Float32Array(new Uint8Array(Buffer.from(r.w, 'base64')).buffer) : new Float32Array(n * 8);
          nuevos.push([prim, w]); nv += n; if (r.moved) { mv++; P[nodo.name] = r.huecos; } if (r.over) { ov++; console.log('    aviso: %s (%s) usa %d articulaciones de más', nodo.name, ex.en, r.over); }
        }
      }
      escribeGLB(path.join(dir, f), g, nuevos);
      console.log('  %s/%s: %d mallas, %d con movimiento, %d vértices, %d con más de 8 articulaciones', c, f, nuevos.length, mv, nv, ov);
      tv += nv; tm += mv; to += ov;
    }
  }
  fs.writeFileSync(path.join(IMP, 'datos', 'movimiento.json'), JSON.stringify(salida));
  console.log('Pesos: %d vértices, %d mallas con movimiento, %d mallas recortadas a 8 articulaciones', tv, tm, to);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
