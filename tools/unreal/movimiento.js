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
const URL = process.argv[2] || 'http://localhost:8765/index.html';
const IMP = path.resolve(process.argv[3] || path.join(RAIZ, 'unreal', 'CorpusAtlas', 'Importar'));
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
  window.__movW=(en,side,sys,b64)=>{const u8=b64d(b64),pos=new Float32Array(u8.buffer,u8.byteOffset,u8.length>>2),n=pos.length/3;
    let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;for(let i=0;i<n;i++){const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;}
    const c=new V3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);let r=0;for(let i=0;i<n;i++)r=Math.max(r,Math.hypot(pos[i*3]-c.x,pos[i*3+1]-c.y,pos[i*3+2]-c.z));
    const m={userData:{c:{en,side},sys},geometry:{attributes:{position:{array:pos}},boundingSphere:{center:c,radius:r},index:null}};
    const Ws=L.map(k=>{let W=null;try{W=weightsFor(m,jn(k));}catch(e){W=null;}if(/^ankle_st_/.test(k)&&en==='Talus')W=null;return [W,!!(m.userData.lin&&m.userData.lin[jn(k)])];});
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
  const salida = { version: 1, unidades: 'm, glTF (Y arriba)', paso: PASO, ax: R.AX, ax_de: R.L.slice(-3),
    articulaciones: R.L.map((k, i) => ({ id: k, pivote: R.piv[i] })), rom };
  fs.mkdirSync(path.join(IMP, 'datos'), { recursive: true });
  fs.writeFileSync(path.join(IMP, 'datos', 'movimiento.json'), JSON.stringify(salida));
  console.log('Posturas: datos/movimiento.json');

  /* ── pesos ── */
  let tv = 0, tm = 0, to = 0;
  salida.piezas = {};
  for (const c of CUERPOS) {
    const P = salida.piezas[c] = {};
    const dir = path.join(IMP, c);
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.glb'))) {
      const g = leeGLB(path.join(dir, f)), nuevos = [];
      let mv = 0, ov = 0, nv = 0;
      for (let ni = 0; ni < g.j.nodes.length; ni++) {
        const nodo = g.j.nodes[ni]; if (nodo.mesh === undefined) continue;
        if (nodo.matrix || nodo.translation || nodo.rotation || nodo.scale) throw new Error('nodo con transformación en ' + f);
        const ex = nodo.extras || {}, sys = ex.sistema || f.replace('.glb', '');
        for (const prim of g.j.meshes[nodo.mesh].primitives) {
          const pos = vista(g, prim.attributes.POSITION), n = pos.length / 3;
          for (const k of Object.keys(prim.attributes)) if (/^TEXCOORD_/.test(k)) delete prim.attributes[k];
          const r = await E('(en,side,sys,b)=>__movW(en,side,sys,b)', ex.en || '', ex.lado || '', sys, Buffer.from(pos.buffer).toString('base64'));
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
