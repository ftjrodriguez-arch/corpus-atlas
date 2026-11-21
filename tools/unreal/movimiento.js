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
  const HARMC=/^(Gluteus (maximus|medius|minimus)|Piriformis|Tensor fasciae latae|Iliacus|Psoas major|Obturator (internus|externus)|(Superior|Inferior) gemellus|Quadratus femoris|Pectineus)( muscle)?$/;
  const HARM=/^((Ascending|Descending|Transverse) part of trapezius|Rhomboid (major|minor)|Levator scapulae|Serratus anterior|Pectoralis minor|Subclavius|(Clavicular|Acromial|Scapular spinal) part of deltoid|Supraspinatus|Infraspinatus|Teres minor|Subscapularis)( muscle)?$/;
  window.__movW=(en,side,sys,b64,b64i)=>{const u8=b64d(b64),pos=new Float32Array(u8.buffer,u8.byteOffset,u8.length>>2),n=pos.length/3;const i8=b64i?b64d(b64i):null,idx=i8?new Uint32Array(i8.buffer,i8.byteOffset,i8.length>>2):null;
    let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;for(let i=0;i<n;i++){const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;}
    const c=new V3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);let r=0;for(let i=0;i<n;i++)r=Math.max(r,Math.hypot(pos[i*3]-c.x,pos[i*3+1]-c.y,pos[i*3+2]-c.z));
    const m={userData:{c:{en,side},sys},geometry:{attributes:{position:{array:pos}},boundingSphere:{center:c,radius:r},index:null}};
    const Ws=L.map(k=>{let W=null;try{W=weightsFor(m,jn(k));}catch(e){W=null;}if(/^ankle_st_/.test(k)&&en==='Talus')W=null;return [W,!!(m.userData.lin&&m.userData.lin[jn(k)])];});
    /* malla soldada por posición, vecinos y hueso más cercano a cada vértice (a menos de 12 mm): para los pesos armónicos */
    let _G=null;const malla=()=>{if(_G)return _G;
      if(!window.__huesos){const cs=0.012,H=new Map();for(const b of meshes){const u=b.userData;if(!u.c||u.sys!=='oseo')continue;const part=skPartOf(b),a=u.rest||b.geometry.attributes.position.array;
          for(let i=0;i<a.length;i+=3){const k=Math.floor(a[i]/cs)+','+Math.floor(a[i+1]/cs)+','+Math.floor(a[i+2]/cs);let l=H.get(k);if(!l)H.set(k,l=[]);l.push(a[i],a[i+1],a[i+2],part);}}window.__huesos={cs,H};}
      const {cs,H}=window.__huesos,RA=0.012,uid=new Int32Array(n),M=new Map();let nu=0;for(let v=0;v<n;v++){const k=Math.round(pos[v*3]*2e4)+','+Math.round(pos[v*3+1]*2e4)+','+Math.round(pos[v*3+2]*2e4);let q=M.get(k);if(q===undefined){q=nu++;M.set(k,q);}uid[v]=q;}
      const rep=new Int32Array(nu).fill(-1);for(let v=0;v<n;v++)if(rep[uid[v]]<0)rep[uid[v]]=v;
      const nb=Array.from({length:nu},()=>new Set());for(let t=0;t<idx.length;t+=3){const a=uid[idx[t]],b=uid[idx[t+1]],c=uid[idx[t+2]];if(a!==b){nb[a].add(b);nb[b].add(a);}if(b!==c){nb[b].add(c);nb[c].add(b);}if(a!==c){nb[a].add(c);nb[c].add(a);}}
      /* los fascículos (islas) que se tocan quedan enlazados: cada vértice se une a los de otras islas a menos de 4 mm.
         Sin esto cada fascículo tenía su propio reparto y uno asomaba entre sus vecinos como una solapa. */
      {const cs2=0.004,H2=new Map();for(let q=0;q<nu;q++){const v=rep[q],k=Math.floor(pos[v*3]/cs2)+','+Math.floor(pos[v*3+1]/cs2)+','+Math.floor(pos[v*3+2]/cs2);let l=H2.get(k);if(!l)H2.set(k,l=[]);l.push(q);}
        for(let q=0;q<nu;q++){const v=rep[q],x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2],fx=Math.floor(x/cs2),fy=Math.floor(y/cs2),fz=Math.floor(z/cs2);let m=0;
          for(let a=-1;a<=1&&m<8;a++)for(let b=-1;b<=1&&m<8;b++)for(let c=-1;c<=1&&m<8;c++){const l=H2.get((fx+a)+','+(fy+b)+','+(fz+c));if(!l)continue;
            for(const p of l){if(p===q||nb[q].has(p))continue;const w=rep[p];if((pos[w*3]-x)**2+(pos[w*3+1]-y)**2+(pos[w*3+2]-z)**2<cs2*cs2){nb[q].add(p);nb[p].add(q);if(++m>=8)break;}}}}}
      const NB=nb.map(s=>Int32Array.from(s)),ancla=new Array(nu).fill(null);
      for(let q=0;q<nu;q++){const v=rep[q],x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2],fx=Math.floor(x/cs),fy=Math.floor(y/cs),fz=Math.floor(z/cs);let bd=RA*RA,bp=null;
        for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){const l=H.get((fx+a)+','+(fy+b)+','+(fz+c));if(!l)continue;for(let t=0;t<l.length;t+=4){const d=(l[t]-x)**2+(l[t+1]-y)**2+(l[t+2]-z)**2;if(d<bd){bd=d;bp=l[t+3];}}}ancla[q]=bp;}
      return _G={uid,nu,rep,NB,ancla};};
    /* ecuación de Laplace sobre la malla con valores fijos en los anclajes (fijo ≥ 0): reparto continuo entre ellos */
    const laplace=(G,fijo,x)=>{for(let it=0;it<2500;it++){let dmax=0;for(let q=0;q<G.nu;q++){if(fijo[q]>=0)continue;const l=G.NB[q];if(!l.length)continue;let s=0;for(let t=0;t<l.length;t++)s+=x[l[t]];const nv=s/l.length,d=Math.abs(nv-x[q]);if(d>dmax)dmax=d;x[q]=nv;}if(dmax<2e-5)break;}return x;};
    /* Dorsal ancho, pectoral mayor y redondo mayor (mejora sobre la web): sus pesos de hombro van a escalones (sectores angulares de shRig) y dejan que
       medio vientre muscular gire con el brazo; la web lo arregla después relajando la malla en la CPU. Aquí: solo los
       últimos centímetros junto al tendón siguen al húmero (la inserción está a ~6 cm de la articulación), el vientre
       queda sobre el tórax y el músculo se estira entre ambos. Peso suave por distancia al punto de inserción. */
    /* [músculo, articulaciones, radio del tendón, longitud en la que se reparte el estiramiento, fibra tensa] */
    const TD=[[/^Latissimus dorsi muscle$/,/^(shoulder|acr|sc)$/,0.02,0.25,1],[/^(Sternocostal head|Abdominal part) of pectoralis major muscle$/,/^(shoulder|acr|sc)$/,0.03,0.16,1],
      [/^Clavicular head of pectoralis major muscle$/,/^(shoulder|acr)$/,0.03,0.10,1],[/^Teres major muscle$/,/^shoulder$/,0.02,0.07,0]].find(x=>x[0].test(en));
    let ins=null;
    if(TD&&(side==='derecho'||side==='izquierdo')){const Sd=side==='derecho'?'R':'L',seg=SEGS['arm_'+Sd],A=seg[0],B=seg[1],ax=B.x-A.x,ay=B.y-A.y,az=B.z-A.z,L2=ax*ax+ay*ay+az*az;
      let bi=0,bd=1e9;for(let i=0;i<n;i++){const px=pos[i*3]-A.x,py=pos[i*3+1]-A.y,pz=pos[i*3+2]-A.z;let t=(px*ax+py*ay+pz*az)/L2;t=t<0?0:t>1?1:t;const dx=px-ax*t,dy=py-ay*t,dz=pz-az*t,d=dx*dx+dy*dy+dz*dz+(t<0.06?0.0004:0);if(d<bd){bd=d;bi=i;}}
      const Ix=pos[bi*3],Iy=pos[bi*3+1],Iz=pos[bi*3+2],Wd=new Float32Array(n);if(TD[4])ins=[Ix,Iy,Iz].map(v=>Math.round(v*1e5)/1e5);
      const dI=i=>Math.hypot(pos[i*3]-Ix,pos[i*3+1]-Iy,pos[i*3+2]-Iz);
      for(let i=0;i<n;i++){let t=(dI(i)-TD[2])/TD[3];t=t<0?0:t>1?1:t;Wd[i]=1-t*t*(3-2*t);}
      /* fracción de fibra: 1 en el tendón de inserción, 0 en el origen (línea media y cresta ilíaca para el dorsal; borde
         esternal para el pectoral; clavícula o escápula donde el músculo nace de ellas) y armónico entre ambos. Con el
         peso «por distancia a la inserción» el origen del dorsal junto a la columna se iba detrás del brazo. */
      if(idx){const G=malla(),fijo=new Float32Array(G.nu).fill(-1),x=new Float32Array(G.nu);let n0=0;
        const LAT=/^Latissimus/.test(en),CLA=/^Clavicular/.test(en),TER=/^Teres/.test(en);
        for(let q=0;q<G.nu;q++){const v=G.rep[q],d=dI(v),px=Math.abs(pos[v*3]),py=pos[v*3+1],an=G.ancla[q];x[q]=Wd[v];
          if(d<TD[2]){fijo[q]=1;continue;}
          const origen=LAT?(px<0.022||py<1.0||d>0.5):CLA?(an==='clav_'+Sd):TER?(an==='scap_'+Sd&&d>0.05):(px<0.035||py<1.12);
          if(origen){fijo[q]=0;n0++;}}
        /* La malla del músculo son varios fascículos sueltos (islas). Un fascículo sin anclaje de origen giraba entero con
           el húmero (el «tendón suelto» del dorsal); uno sin anclaje de inserción se quedaba atrás. A cada isla que le falta
           un extremo se le fija, en su punta más lejana o más cercana a la inserción, el peso por distancia de sus vecinas. */
        {const isla=new Int32Array(G.nu).fill(-1);let ni=0;for(let s=0;s<G.nu;s++){if(isla[s]>=0)continue;const pila=[s];isla[s]=ni;while(pila.length){const q=pila.pop(),l=G.NB[q];for(let t=0;t<l.length;t++)if(isla[l[t]]<0){isla[l[t]]=ni;pila.push(l[t]);}}ni++;}
          const dmn=new Float32Array(ni).fill(1e9),dmx=new Float32Array(ni),h0=new Uint8Array(ni),h1=new Uint8Array(ni),dq=new Float32Array(G.nu);
          for(let q=0;q<G.nu;q++){const d=dq[q]=dI(G.rep[q]),c=isla[q];if(d<dmn[c])dmn[c]=d;if(d>dmx[c])dmx[c]=d;if(fijo[q]===0)h0[c]=1;else if(fijo[q]===1)h1[c]=1;}
          for(let q=0;q<G.nu;q++){const c=isla[q];if(fijo[q]>=0)continue;if(!h1[c]&&dq[q]<=dmn[c]+0.015){fijo[q]=x[q];}else if(!h0[c]&&dq[q]>=dmx[c]-0.02){fijo[q]=x[q];n0++;}}
          window.__islas=(window.__islas||'')+' '+en.slice(0,14)+':'+ni;}
        if(n0>3){laplace(G,fijo,x);for(let v=0;v<n;v++)Wd[v]=x[G.uid[v]];}}
      L.forEach((k,q)=>{const [nd,sd]=k.split('_');if(sd===Sd&&TD[1].test(nd))Ws[q]=[Wd,true];else if(/^(elbow|fore|wrist|hip|knee)$/.test(nd)||(sd&&sd!==Sd&&/^(shoulder|acr|sc)$/.test(nd)))Ws[q]=[null,false];});}
    /* Músculos tendidos entre dos huesos de la cintura escapular (mejora sobre la web, donde el trapecio, los romboides o
       el serrato no acompañan a la escápula y lo que hay debajo los atraviesa). Cada músculo queda anclado a sus huesos:
       donde toca la escápula va con ella, donde toca vértebras o costillas se queda, donde toca el húmero va con él.
       Entre los anclajes el peso es armónico (ecuación de Laplace sobre la malla): el estiramiento se reparte de forma
       continua por toda la fibra, sin escalones ni zonas rígidas. */
    /* Lo mismo en la cadera (HARMC): en la web los glúteos y los pelvitrocantéreos están fijados a la pelvis y en la
       flexión de cadera el glúteo mayor quedaba como una bola. Aquí van de la pelvis (0) al fémur (1) y giran en arco
       alrededor de la cadera (envuelven la articulación), no en línea recta. */
    const CAD=HARMC.test(en);
    if(idx&&(HARM.test(en)||CAD)&&(side==='derecho'||side==='izquierdo')){const Sd=side==='derecho'?'R':'L';
      const ESC=/trapezius|Rhomboid|Levator scapulae|Serratus anterior|Pectoralis minor|Subclavius/.test(en);/* ESC: unen tórax y escápula, no llegan al húmero */
      const G=malla(),{uid,nu,rep,ancla}=G;
      for(const nodo of (CAD?['hip']:['shoulder','acr','sc'])){const kq=L.indexOf(nodo+'_'+Sd);if(kq<0)continue;if(ESC&&nodo==='shoulder'){Ws[kq]=[null,false];continue;}const W0=Ws[kq][0];
        const fijo=new Float32Array(nu).fill(-1);let n0=0,n1=0;for(let q=0;q<nu;q++){if(ancla[q]===null)continue;const f=skF(ancla[q],nodo,Sd)>0?1:0;fijo[q]=f;if(f)n1++;else n0++;}
        if(n0<4||n1<4)continue;/* sin dos anclajes distintos se dejan los pesos de la web */
        const x=new Float32Array(nu);for(let q=0;q<nu;q++)x[q]=fijo[q]>=0?fijo[q]:(W0?Math.min(1,W0[rep[q]]):0.5);
        laplace(G,fijo,x);
        const Wn=new Float32Array(n);for(let v=0;v<n;v++)Wn[v]=x[uid[v]];Ws[kq]=[Wn,!CAD];}
      /* El glúteo mayor se probó como fibra tensa (recto del sacro al fémur): atraviesa la pelvis y se hunde. Se queda
         girando en arco, que envuelve la cadera por detrás; en flexión de más de 90° aún se ve enrollado (pendiente:
         envolverlo sobre la pelvis como se hace con el tórax). */
      /* los que se insertan en la escapula la siguen igual en sus dos articulaciones (acromioclavicular y esternoclavicular) */
      if(ESC&&!/Subclavius|Descending/.test(en)){const qa=L.indexOf('acr_'+Sd),qs=L.indexOf('sc_'+Sd);if(Ws[qs][0]&&!Ws[qa][0])Ws[qa]=[Ws[qs][0],Ws[qs][1]];}
      L.forEach((k,q)=>{const [nd,sd]=k.split('_');if(CAD?(/^(shoulder|acr|sc|elbow|fore|wrist)$/.test(nd)||(sd&&sd!==Sd&&nd==='hip')):(/^(elbow|fore|wrist|hip|knee)$/.test(nd)||(sd&&sd!==Sd&&/^(shoulder|acr|sc)$/.test(nd))))Ws[q]=[null,false];});}
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
    return {w:S.length?b64e(new Uint8Array(out.buffer)):'',huecos:S.map(s=>(s.lin?-1:1)*s.i),over,moved:S.length>0,ins};};
  /* lista de giros de la web → [índice, eje, ángulo, traslación] por articulación del rig (rodilla con deslizamiento, tobillo partido) */
  const aOps=cap=>{const act=(cap||[]).map(a=>{if(a.tr||!/^knee_/.test(a.jn))return a;const tt=kneeTr(a.q,a.jn);return tt?Object.assign({},a,{tr:tt}):a;});
    const ops=act.map(a=>{const q=a.q;let ang=2*Math.acos(Math.min(1,Math.abs(q.w)));const s=Math.sqrt(Math.max(0,1-q.w*q.w));
      let ax=s>1e-6?new V3(q.x/s,q.y/s,q.z/s):new V3(1,0,0);if(q.w<0)ax.negate();return {jn:a.jn,ang,ax,p:JOINTS[a.jn].pivot,tr:a.tr?a.tr.clone().applyQuaternion(a.q):null};}).filter(o=>o.ang>1e-4||o.tr);
    const R=[],fuera=[];const pon=(k,o)=>{const i=L.indexOf(k);if(i<0){fuera.push(k);return;}const f=v=>Math.round(v*1e5)/1e5;
      R.push([i,f(o.ax.x),f(o.ax.y),f(o.ax.z),f(o.ang),o.tr?f(o.tr.x):0,o.tr?f(o.tr.y):0,o.tr?f(o.tr.z):0]);};
    for(const o of ops){if(/^ankle_/.test(o.jn)){const sp=ankleSplit(o),S2=o.jn.slice(6);pon('ankle_st_'+S2,sp.sw);pon('ankle_tc_'+S2,sp.tw);}else pon(o.jn,o);}
    R.sort((a,b)=>a[0]-b[0]);return {R,fuera};};
  /* marcha: applyPose() de la web con la marcha puesta (ángulos de laboratorio, pelvis, centro de masas, braceo y, tras deformar,
     gaitFloor() que apoya el pie en el suelo). Se guardan los giros y la raíz del cuerpo (cuaternión + posición). */
  window.__movGait=(pat,p)=>{gait.on=true;gait.pat=pat;gait.p=p;const tab=currentTab;currentTab='mov';let cap=null;const D0=deform;deform=a=>{cap=a;D0(a);};
    try{applyPose();}finally{deform=D0;currentTab=tab;}
    const r=aOps(cap),q=body.quaternion,ps=body.position,f=v=>Math.round(v*1e5)/1e5;r.raiz=[q.x,q.y,q.z,q.w,ps.x,ps.y,ps.z].map(f);return r;};
  window.__movGaitFin=()=>{gait.on=false;gait.pat='normal';try{gaitRootOff();}catch(e){}const tab=currentTab;currentTab='mov';try{applyPose();}finally{currentTab=tab;}};
  const sinHTML=s=>String(s||'').replace(/<[^>]+>/g,'');
  window.__movGaitMeta=()=>({fases:GAIT_PH.map(f=>[f[0],f[1],f[2],f[3],f[4]]),
    grupos:GAIT_M.map((m,i)=>({en:m[0],tramos:m[1],n:m[2],tipo:m[3],txt:m[4],lv:GAIT_LV[i]||[]})),
    patrones:Object.entries(GAIT_P).map(([k,v])=>({id:k,n:v.n,t:sinHTML(v.t),debiles:v.weak||[],espasticos:v.spastic||[],vel:v.speed||1}))});
  window.__movPose=(jid,mi,S,t)=>{const j=ROM.find(x=>x.id===jid);curJ=j;curM=typeof mi==='object'?Object.assign({pl:'sag',dir:[0,-1,0],ag:[]},mi):j.moves[mi];romSide=S;angle=t;
    const tab=currentTab;currentTab='mov';let cap=null;const D0=deform;deform=a=>{cap=a;};
    try{applyPose();}finally{deform=D0;currentTab=tab;}
    const act=(cap||[]).map(a=>{if(a.tr||!/^knee_/.test(a.jn))return a;const tt=kneeTr(a.q,a.jn);return tt?Object.assign({},a,{tr:tt}):a;});
    const ops=act.map(a=>{const q=a.q;let ang=2*Math.acos(Math.min(1,Math.abs(q.w)));const s=Math.sqrt(Math.max(0,1-q.w*q.w));
      let ax=s>1e-6?new V3(q.x/s,q.y/s,q.z/s):new V3(1,0,0);if(q.w<0)ax.negate();return {jn:a.jn,ang,ax,p:JOINTS[a.jn].pivot,tr:a.tr?a.tr.clone().applyQuaternion(a.q):null};}).filter(o=>o.ang>1e-4||o.tr);
    const R=[],fuera=[];const pon=(k,o)=>{const i=L.indexOf(k);if(i<0){fuera.push(k);return;}const f=v=>Math.round(v*1e5)/1e5;
      R.push([i,f(o.ax.x),f(o.ax.y),f(o.ax.z),f(o.ang),o.tr?f(o.tr.x):0,o.tr?f(o.tr.y):0,o.tr?f(o.tr.z):0]);};
    for(const o of ops){if(/^ankle_/.test(o.jn)){const sp=ankleSplit(o),S2=o.jn.slice(6);pon('ankle_st_'+S2,sp.sw);pon('ankle_tc_'+S2,sp.tw);}else pon(o.jn,o);}
    R.sort((a,b)=>a[0]-b[0]);return {R,fuera};};
  /* ejercicios. Sentadilla: el módulo de cadena cerrada de la web (SQ). applyPose() resuelve piernas, pelvis y raíz del cuerpo
     (pies fijos en el suelo); el resolutor guarda estado de una postura a la siguiente, así que se recorre el ciclo en orden. */
  window.__movSqIni=d=>{gait.on=false;try{gaitRootOff();}catch(e){}SQ.depth=d;SQ.bottom=null;SQ.base=null;SQ.st=null;SQ.lv=null;SQ.lastPitch=0;SQ.p=0;SQ.on=true;
    SQ.bottom=sqBottom();const B=SQ.bottom,r1=v=>Math.round(v*10)/10;return {K:r1(B.K),H:r1(B.H),A:r1(B.A),tau:r1(B.tau),L:r1(B.L),limit:B.limit||'',warn:B.warn||[]};};
  window.__movSq=p=>{SQ.p=p;const tab=currentTab;currentTab='mov';let cap=null;const D0=deform;deform=a=>{cap=a;};try{applyPose();}finally{deform=D0;currentTab=tab;}
    const r=aOps(cap),q=body.quaternion,ps=body.position,f=v=>Math.round(v*1e5)/1e5,A=SQ.cur;r.raiz=[q.x,q.y,q.z,q.w,ps.x,ps.y,ps.z].map(f);r.med=[A.H,A.K,A.A,A.tau].map(v=>Math.round(v*10)/10);return r;};
  window.__movSqFin=()=>{SQ.on=false;sqApplyRoot(false);};
  window.__movSqMeta=paso=>({fases:SQ_PH.map(f=>({ini:f[0],fin:f[1],k:f[3],n:SQ_PHN[f[3]],x:SQ_PHG[f[3]]})),
    grupos:SQ_M.map((m,i)=>{const lv=[];for(let p=0;p<100;p+=paso)lv.push(Math.round(sqLevel(i,p)*1000)/1000);return {en:m[0],n:m[1],x:m[2],tipo:m[3],lv};}),
    variantes:Object.entries(SQ_DEPTH).map(([k,v])=>({id:k,n:v.n}))});
  /* nombre y textos de un ejercicio: entrada de CTESTS (ex, how, pos) y EJ_TXT (errores, progresiones, precauciones) */
  window.__movEjTxt=id=>{const c=CTESTS.find(x=>x.id===id),e=(typeof EJ_TXT!=='undefined'&&EJ_TXT[id])||{};return c?{n:c.n,ex:c.ex,how:c.how,pos:c.pos,err:e.err,prog:e.prog,contra:e.contra}:null;};
  const v3=v=>[v.x,v.y,v.z].map(x=>Math.round(x*1e6)/1e6);const rodilla={};for(const S of ['R','L']){const J=JOINTS['knee_'+S];rodilla[S]={largo:v3(J.long||new V3(0,1,0)),x:v3(J.xax||new V3(1,0,0))};}
  return {L,AX,rodilla,piv:L.map(k=>{const p=piv(k);return [p.x,p.y,p.z].map(v=>Math.round(v*1e5)/1e5);}),
    rom:ROM.filter(j=>!${JSON.stringify(ROM_FUERA)}.includes(j.id)).map(j=>({id:j.id,n:j.n,sided:!!j.sided,moves:j.moves.map(m=>({n:m.n,max:m.max,ax:m.ax,sg:m.sg,ag:m.ag||[]}))}))};
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

  /* ── ejercicios (tools/unreal/ejercicios.json): fotogramas del ciclo con la raíz del cuerpo, fases, músculos y textos ──
     Cada «fuente» sabe hornear una clase de ejercicio; un ejercicio nuevo de una fuente que ya existe es solo una entrada
     más en el JSON. Los textos van en cinco idiomas (idiomas.js: mismo criterio que estudio.js). */
  const EJ = JSON.parse(fs.readFileSync(path.join(__dirname, 'ejercicios.json'), 'utf8')), ID = require('./idiomas.js');
  const c5 = a => { const o = ID.cinco(a); if (!o) return o; const t = (EJ.traducciones || {})[o.es]; if (t) { for (const l of ['fr', 'de']) if (t[l]) { o[l] = t[l]; ID.faltan[l].delete(o.es); } } return o; };
  const textosEj = async e => { const T = await E('id=>__movEjTxt(id)', e.id); if (!T) throw new Error('ejercicio sin entrada en CTESTS: ' + e.id);
    return { n: c5(T.n), textos: ['ex', 'how', 'pos', 'err', 'prog', 'contra'].filter(k => T[k]).map(k => [EJ.ui[k], c5(T[k])]) }; };
  const FUENTES = {
    sentadilla: async e => { const PS = 2, meta = await E('p=>__movSqMeta(p)', PS), T = await textosEj(e);
      const fases = meta.fases.map(f => ({ ini: f.ini, fin: f.fin, tipo: (e.tipo_fase || {})[f.k] || '', n: c5(f.n), x: c5(f.x) }));
      const orden = { DE: 0, FO: 1, AS: 2 };
      const grupos = meta.grupos.map(g => ({ en: g.en, n: c5(g.n), x: c5(g.x), tipo: meta.fases.map(f => orden[f.k] === undefined ? '' : g.tipo[orden[f.k]]), lv: g.lv }));
      const variantes = [];
      for (const v of meta.variantes.filter(v => !e.variantes || e.variantes.includes(v.id))) { const fondo = await E('d=>__movSqIni(d)', v.id), V = { id: v.id, n: c5(v.n), fondo, frames: [], raiz: [], med: [] };
        for (let p = 0; p < 100; p += PS) { const r = await E('p=>__movSq(p)', p); V.frames.push(r.R.flat()); V.raiz.push(r.raiz); V.med.push(r.med); if (r.fuera.length) console.log('  aviso: sentadilla fuera del rig: %s', [...new Set(r.fuera)].join(',')); }
        variantes.push(V); console.log('  ejercicio %s/%s: %d instantes, fondo cadera %s° rodilla %s° tobillo %s° tronco %s°%s', e.id, v.id, V.frames.length, fondo.H, fondo.K, fondo.A, fondo.tau, fondo.limit ? ' (tope: ' + fondo.limit + ')' : ''); }
      await E('()=>__movSqFin()');
      return { id: e.id, n: T.n, paso: PS, duracion: e.duracion || 4, vista: e.vista === undefined ? 2 : e.vista, inicial: Math.max(0, variantes.findIndex(v => v.id === e.inicial)),
        fases, grupos, medidas: EJ.medidas_sentadilla, variantes, textos: T.textos }; },
  };
  const hornearEjercicios = async () => { const lista = [];
    for (const e of EJ.ejercicios || []) { if (!FUENTES[e.fuente]) { console.log('  aviso: ejercicio %s con fuente desconocida «%s»', e.id, e.fuente); continue; } lista.push(await FUENTES[e.fuente](e)); }
    for (const l of ['fr', 'de']) if (ID.faltan[l].size) console.log('  ejercicios: %d textos sin %s (salen en inglés):\n    %s', ID.faltan[l].size, l, [...ID.faltan[l]].map(s => JSON.stringify(s)).join('\n    '));
    return { ui: EJ.ui, lista }; };
  const jf0 = path.join(IMP, 'datos', 'movimiento.json');
  if (process.argv.includes('--solo-ejercicios')) {   // rápido: deja rangos, marcha y pesos como están y rehace solo los ejercicios
    const antes0 = JSON.parse(fs.readFileSync(jf0, 'utf8')); antes0.ejercicios = await hornearEjercicios();
    fs.writeFileSync(jf0, JSON.stringify(antes0)); console.log('Ejercicios: datos/movimiento.json (lo demás sin tocar)'); await b.close(); return; }

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
  /* ── marcha: cada 2 % del ciclo, los 8 patrones de la web ── */
  const marcha = await E('()=>__movGaitMeta()'); marcha.paso = 2;
  for (const pt of marcha.patrones) { pt.frames = []; pt.raiz = []; const fu = new Set();
    for (let p = 0; p < 100; p += marcha.paso) { const r = await E('(k,p)=>__movGait(k,p)', pt.id, p); pt.frames.push(r.R.flat()); pt.raiz.push(r.raiz); r.fuera.forEach(x => fu.add(x.replace(/_[RL]$/, ''))); }
    console.log('  marcha %s: %d instantes%s', pt.id, pt.frames.length, fu.size ? ' (fuera del rig: ' + [...fu].join(',') + ')' : ''); }
  await E('()=>__movGaitFin()');
  const ejercicios = await hornearEjercicios();
  /* cuaterniones [x, y, z, w] y eje-ángulo para retocar las posturas horneadas */
  const qAA = (ax, an) => { const s = Math.sin(an / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(an / 2)]; };
  const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qInv = q => [-q[0], -q[1], -q[2], q[3]];
  const qRot = (q, v) => { const u = [q[0], q[1], q[2]], c1 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]].map(x => 2 * x);
    const c2 = [u[1] * c1[2] - u[2] * c1[1], u[2] * c1[0] - u[0] * c1[2], u[0] * c1[1] - u[1] * c1[0]]; return v.map((x, i) => x + q[3] * c1[i] + c2[i]); };
  const aAA = q => { if (q[3] < 0) q = q.map(x => -x); const an = 2 * Math.acos(Math.min(1, q[3])), s = Math.sqrt(Math.max(0, 1 - q[3] * q[3])); return s > 1e-6 ? [q[0] / s, q[1] / s, q[2] / s, an] : [1, 0, 0, 0]; };
  /* ── rangos propios de esta edición (tools/unreal/rangos_extra.json): no se toca la tabla ROM de la web ──
     Cada entrada se hornea con applyPose() de la web como un movimiento más. Si la web ya trae ese movimiento (mismo eje,
     sentido y máximo en ese rango) no se duplica: se comprueba que las posturas coinciden y se le añaden las traducciones
     y la nota. Así el JSON vale tanto si la web lo tiene como si no. */
  const EXTRA = JSON.parse(fs.readFileSync(path.join(__dirname, 'rangos_extra.json'), 'utf8'));
  const hornea = async (jid, mv, S, max) => { const fr = [];
    for (let t = 0; t <= max + 1e-6; t += PASO) fr.push((await E('(j,mi,S,t)=>__movPose(j,mi,S,t)', jid, mv, S, Math.min(t, max))).R.flat());
    if (max % PASO) fr.push((await E('(j,mi,S,t)=>__movPose(j,mi,S,t)', jid, mv, S, max)).R.flat());
    return fr; };
  for (const e of EXTRA.rangos || []) {
    const r = rom.find(x => x.id === e.rom), meta = R.rom.find(x => x.id === e.rom);
    if (!r) { console.log('  aviso: rangos_extra pide el rango «%s», que no existe', e.rom); continue; }
    const mv = { n: e.n.es, ax: e.ax, sg: e.sg, max: e.max, pl: e.pl || 'sag', dir: e.dir || [0, -1, 0], help: e.help || {}, ag: e.ag || [] };
    const ya = meta.moves.findIndex(m => m.ax === e.ax && m.sg === e.sg && m.max === e.max);
    if (ya >= 0) {
      const propio = await hornea(e.rom, mv, 'R', e.max), web = r.movs[ya].R; let dif = propio.length === web.length ? 0 : Infinity;
      for (let i = 0; i < Math.min(propio.length, web.length); i++) { if (propio[i].length !== web[i].length) { dif = Infinity; break; } for (let k = 0; k < propio[i].length; k++) dif = Math.max(dif, Math.abs(propio[i][k] - web[i][k])); }
      console.log('  extra %s/%s: la web ya lo trae («%s»); posturas %s', e.rom, e.n.es, r.movs[ya].n, dif < 1e-4 ? 'idénticas' : 'DISTINTAS (dif. máx. ' + dif + '): se deja la de la web');
      r.movs[ya].tr = e.n; if (e.nota) r.movs[ya].nota = e.nota; continue; }
    const M = { n: e.n.es, tr: e.n, max: e.max, paso: PASO, ag: e.ag || [], propio: true }; if (e.nota) M.nota = e.nota;
    for (const S of ((r.lados || e.ax !== 'x') ? ['R', 'L'] : ['R'])) M[S] = await hornea(e.rom, mv, S, e.max);
    r.movs.push(M); console.log('  extra %s/%s: horneado (%d posturas por lado)', e.rom, e.n.es, M.R.length); }
  for (const nt of EXTRA.notas || []) { const r = rom.find(x => x.id === nt.rom), M = r && r.movs.find(m => m.n === nt.mov); if (M) M.nota = nt.nota; else console.log('  aviso: nota sin movimiento: %s/%s', nt.rom, nt.mov); }
  /* ── mejora sobre la web: rotación automática de la rodilla (screw-home) ──
     La malla de reposo es la rodilla extendida y bloqueada. Al flexionar, la tibia rota hacia dentro alrededor de su eje
     largo, de forma progresiva, hasta «grados» en los primeros «arco» grados de flexión (al revés: en los últimos 15° de
     extensión rota hacia fuera). Se compone después del giro de la web (q · q_axial, como el orden clínico de qOf).
     Solo en los rangos articulares (cadena abierta): en la marcha y la sentadilla el pie está apoyado y giraría sobre el suelo. */
  { const RA = EXTRA.rotacion_automatica; let nra = 0, amax = 0;
    if (RA && RA.grados) for (const S of ['R', 'L']) { const iK = R.L.indexOf(RA.articulacion + '_' + S), ej = R.rodilla[S]; if (iK < 0) continue;
      for (const r of rom) for (const M of r.movs) for (const lado of ['R', 'L']) { if (!M[lado]) continue;
        M[lado] = M[lado].map(fr => { let toca = false; const out = fr.slice();
          for (let k = 0; k < out.length; k += 8) { if (out[k] !== iK || !out[k + 4]) continue;
            const q = qAA(out.slice(k + 1, k + 4), out[k + 4]);
            const flex = 2 * Math.atan2(q[0] * ej.x[0] + q[1] * ej.x[1] + q[2] * ej.x[2], q[3]) * 180 / Math.PI;   // componente de flexión (grados)
            let u = flex / RA.arco; u = u < 0 ? 0 : u > 1 ? 1 : u; const rot = RA.grados * u * u * (3 - 2 * u) * (S === 'L' ? -1 : 1);   // + = rotación interna en el lado derecho
            if (Math.abs(rot) < 1e-4) continue;
            const a = aAA(qMul(q, qAA(ej.largo, rot * Math.PI / 180))), f5 = x => Math.round(x * 1e5) / 1e5;
            out[k + 1] = f5(a[0]); out[k + 2] = f5(a[1]); out[k + 3] = f5(a[2]); out[k + 4] = f5(a[3]); toca = true; amax = Math.max(amax, Math.abs(rot)); }
          if (toca) nra++; return out; }); } }
    console.log('Rotación automática de la rodilla: %d posturas, hasta %s° en los primeros %d° de flexión', nra, amax.toFixed(1), RA ? RA.arco : 0); }
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
  const TX = require('./torax.js');
  const torax = TX.contorno(leeGLB, vista, path.join(IMP, 'hombre', 'oseo.glb'));   // radio de las costillas por altura y ángulo
  /* ── mejora sobre la web: la escápula resbala pegada a las costillas ──
     Con las posturas de la web, al rotar hacia arriba el ángulo inferior de la escápula se despega varios centímetros de
     la parrilla costal (asoma por la espalda). Aquí se añade a la acromioclavicular el giro mínimo, alrededor del eje
     perpendicular al brazo de palanca acromion → ángulo inferior, que devuelve el ángulo a su distancia de reposo del
     contorno del tórax; la glenohumeral se recalcula para que el húmero quede exactamente donde estaba. */
  {
    const rig = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'rig.json'), 'utf8'));
    const kDe = p => [TX.k(torax, p), TX.radio(torax, p)];
    const sobre = (p, piv, q) => qRot(q, p.map((x, i) => x - piv[i])).map((x, i) => x + piv[i]);
    /* Elevación y depresión de la cintura escapular: la clavícula gira sobre la esternoclavicular y la acromioclavicular
       compensa, de modo que la escápula sube o baja casi sin girar (es una traslación sobre el tórax). En la web la
       escápula giraba entera con la clavícula. */
    { const e0 = rom.find(r => r.id === 'escapula');
      if (e0) e0.movs.slice(0, 2).forEach(M => { for (const S of ['R', 'L']) { if (!M[S]) continue; const iA = R.L.indexOf('acr_' + S), iC = R.L.indexOf('sc_' + S), f5 = x => Math.round(x * 1e5) / 1e5;
        M[S] = M[S].map(fr => { const ops = []; for (let k = 0; k < fr.length; k += 8) ops.push(fr.slice(k, k + 8));
          const oC = ops.find(o => o[0] === iC); if (!oC) return fr; const a = aAA(qInv(qAA(oC.slice(1, 4), oC[4]))), sin = ops.filter(o => o[0] !== iA);
          sin.push([iA, f5(a[0]), f5(a[1]), f5(a[2]), f5(a[3]), 0, 0, 0]); return sin.sort((x, y) => x[0] - y[0]).flat(); }); } }); }
    let nfix = 0, amax = 0;
    for (const r of rom) for (const M of r.movs) for (const S of ['R', 'L']) { if (!M[S]) continue;
      const iA = R.L.indexOf('acr_' + S), iC = R.L.indexOf('sc_' + S), iH = R.L.indexOf('shoulder_' + S), pA = R.piv[iA], pC = R.piv[iC], tip0 = rig['scapBot_' + S], k0 = kDe(tip0)[0];
      M[S] = M[S].map(fr => { const ops = []; for (let k = 0; k < fr.length; k += 8) ops.push(fr.slice(k, k + 8));
        const oA = ops.find(o => o[0] === iA); if (!oA) return fr;
        const oC = ops.find(o => o[0] === iC), oH = ops.find(o => o[0] === iH);
        const qA = qAA(oA.slice(1, 4), oA[4]), qC = oC ? qAA(oC.slice(1, 4), oC[4]) : [0, 0, 0, 1];
        const tipA = sobre(tip0, pA, qA), fin = q => sobre(sobre(tip0, pA, q), pC, qC);
        const [k1, rr] = kDe(fin(qA)), tol = 0.003 / rr;
        if (k1 <= k0 + tol) return fr;
        /* eje: perpendicular a la palanca y a la normal de la pared torácica, llevado al marco anterior a la esternoclavicular */
        const t = fin(qA), nrm = [t[0], 0, t[2] - torax.zc], v = t.map((x, i) => x - sobre(pA, pC, qC)[i]);
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
    /* Movimientos propios de la cintura escapular (encoger, deprimir, protraer, retraer): en la web el brazo entero gira
       con la clavícula (al elevar 40° se abría 40°). En realidad el húmero sigue colgando: la glenohumeral compensa. */
    const esc = rom.find(r => r.id === 'escapula'); let ncomp = 0;
    if (esc) for (const M of esc.movs) for (const S of ['R', 'L']) { if (!M[S]) continue;
      const iA = R.L.indexOf('acr_' + S), iC = R.L.indexOf('sc_' + S), iH = R.L.indexOf('shoulder_' + S);
      M[S] = M[S].map(fr => { const ops = []; for (let k = 0; k < fr.length; k += 8) ops.push(fr.slice(k, k + 8));
        const oA = ops.find(o => o[0] === iA), oC = ops.find(o => o[0] === iC); if (!oA && !oC) return fr;
        const qA = oA ? qAA(oA.slice(1, 4), oA[4]) : [0, 0, 0, 1], qC = oC ? qAA(oC.slice(1, 4), oC[4]) : [0, 0, 0, 1];
        const h = aAA(qInv(qMul(qC, qA))), f5 = x => Math.round(x * 1e5) / 1e5, sin = ops.filter(o => o[0] !== iH);
        sin.push([iH, f5(h[0]), f5(h[1]), f5(h[2]), f5(h[3]), 0, 0, 0]); ncomp++;
        return sin.sort((a, b) => a[0] - b[0]).flat(); }); }
    console.log('Escápula sobre las costillas: %d posturas corregidas, giro añadido máximo %s° · cintura escapular con el brazo colgando: %d posturas', nfix, (amax * 57.2958).toFixed(1), ncomp);
  }
  const abrazo = {};
  for (const c of CUERPOS) { const g = leeGLB(path.join(IMP, c, 'muscular.glb'));
    abrazo[c] = g.j.nodes.filter(nd => /^(Latissimus dorsi muscle|Teres major muscle|.* of pectoralis major muscle)$/.test((nd.extras || {}).en || '')).map(nd => nd.name); }

  const SIN_PESOS = process.argv.includes('--sin-pesos');
  const SOLO = (process.argv.find(a => a.startsWith('--solo=')) || '').slice(7);   // --solo=muscular: rehace los pesos de esa capa nada más
  const jf = path.join(IMP, 'datos', 'movimiento.json');
  const antes = (SIN_PESOS || SOLO) && fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : null;
  const salida = { version: 2, unidades: 'm, glTF (Y arriba)', paso: PASO, ax: R.AX, ax_de: R.L.slice(-3),
    articulaciones: R.L.map((k, i) => ({ id: k, pivote: R.piv[i] })), rom, marcha, ejercicios, torax, abrazo, piezas: antes ? antes.piezas : {}, insercion: antes && antes.insercion ? antes.insercion : {} };
  fs.mkdirSync(path.join(IMP, 'datos'), { recursive: true });
  fs.writeFileSync(jf, JSON.stringify(salida));
  console.log('Posturas: datos/movimiento.json');
  if (SIN_PESOS) { console.log('Pesos: sin tocar (--sin-pesos)'); await b.close(); return; }

  /* ── pesos ── */
  /* El nombre en inglés de cada pieza sale del catálogo de hoy, no del que quedó grabado en el GLB al exportar: las
     tablas TD, HARM y HARMC van por nombre (el catálogo tuvo cruzadas las porciones ascendente y descendente del trapecio). */
  const CATN = {}; for (const r of JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'catalog.json'), 'utf8'))) CATN[r[0]] = r[1];
  let tv = 0, tm = 0, to = 0;
  if (!SOLO) salida.piezas = {};
  for (const c of CUERPOS) {
    const P = salida.piezas[c] = salida.piezas[c] || {};
    salida.insercion = salida.insercion || {}; const INS = salida.insercion[c] = salida.insercion[c] || {};
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
          const r = await E('(en,side,sys,b,bi)=>__movW(en,side,sys,b,bi)', CATN[nodo.name] || ex.en || '', ex.lado || '', sys, Buffer.from(pos.buffer).toString('base64'), ind);
          const w = r.w ? new Float32Array(new Uint8Array(Buffer.from(r.w, 'base64')).buffer) : new Float32Array(n * 8);
          nuevos.push([prim, w]); nv += n; if (r.moved) { mv++; P[nodo.name] = r.huecos; } if (r.ins) INS[nodo.name] = r.ins; if (r.over) { ov++; console.log('    aviso: %s (%s) usa %d articulaciones de más', nodo.name, ex.en, r.over); }
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
