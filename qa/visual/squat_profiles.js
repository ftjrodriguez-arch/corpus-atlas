// Personalización: la misma app con distintas profundidades y perfiles de movilidad.
// Para cada caso: postura del fondo, avisos, pies quietos y captura lateral en el fondo.
const cases = [
  ['media_adulto', 'med', {sex:'M',age:30,hip:130,knee:138,df:38}],
  ['profunda_adulto', 'prof', {sex:'M',age:30,hip:130,knee:138,df:38}],
  ['paralela_tobillo_rigido', 'par', {sex:'M',age:30,hip:130,knee:138,df:20}],
  ['profunda_cadera_limitada', 'prof', {sex:'M',age:30,hip:105,knee:138,df:38}],
  ['paralela_mujer_65', 'par', null],
];
const out = {};
E(`showTab('mov');`);
for (const [name, depth, prof] of cases) {
  const r = E(`(()=>{SQ.depth='${depth}';if(SQ.on)setSq(false);
    SQ.prof=${prof ? JSON.stringify(prof) : "Object.assign({sex:'F',age:65},sqRef('F',65))"};
    setSq(true);SQ.depth='${depth}';SQ.bottom=null;SQ.base=null;SQ.st=null;SQ.lv=null;SQ.play=false;
    const W=p=>p.clone().applyMatrix4(body.matrixWorld);
    const feet=()=>{const R=SQ.root,o=[];for(const S of ['R','L'])for(const k of ['heel','toe'])o.push(W(sqChain(new V3(...RIG[k+'_'+S]),S,R.qs[S])));return o;};
    SQ.p=0;sqUpdate();const f0=feet();SQ.p=50;sqUpdate();const f1=feet();let sl=0,li=0;f0.forEach((p,i)=>{const d=f1[i].clone().sub(p);sl=Math.max(sl,Math.hypot(d.x,d.z));li=Math.max(li,Math.abs(d.y));});
    const B=SQ.bottom;return {profile:sqProf(),bottom:{K:+B.K.toFixed(0),H:+B.H.toFixed(0),A:+B.A.toFixed(0),trunk:+B.tau.toFixed(0),lumbar:+B.L.toFixed(1),thigh:+B.th.toFixed(0),warn:B.warn,limit:B.limit},
      footSlide_mm:+(sl*1000).toFixed(1),footLift_mm:+(li*1000).toFixed(1),warnText:$('#sqWarn').textContent.trim()};})()`);
  out[name] = r;
  E(`orb.th=orb.T.th=${-Math.PI/2};orb.ph=orb.T.ph=1.5;orb.r=orb.T.r=3.2;orb.tgt.set(0,0.62,0.1);orb.T.tgt.set(0,0.62,0.1);`);
  await shot(`perfil_${name}`);
}
return out;
