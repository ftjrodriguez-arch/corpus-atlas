// Verificación de la sentadilla (bucle visual de la skill, sección 9).
// Métricas por código + matriz de 5 cámaras × 4 fases + primeros planos.
// Fases: 0 de pie, 26 mitad del descenso, 50 fondo, 74 mitad del ascenso.
const depth = 'par';
E(`showTab('mov');SQ.depth='${depth}';store.set('sqDepth','${depth}');setSq(true);SQ.play=false;`);
const metrics = E(`(()=>{
 const W=p=>p.clone().applyMatrix4(body.matrixWorld);
 const pts=()=>{const R=SQ.root,o={};for(const S of ['R','L']){for(const k of ['heel','toe'])o[k+S]=W(sqChain(new V3(...RIG[k+'_'+S]),S,R.qs[S]));
   o['lat'+S]=W(sqChain(new V3(...RIG['heel_'+S]).add(new V3(S==='R'?-0.05:0.05,0,0)),S,R.qs[S]));o['knee'+S]=W(sqChain(JOINTS['knee_'+S].pivot,S,R.qs[S],'knee'));o['hip'+S]=W(JOINTS['hip_'+S].pivot);}return o;};
 const inBone=()=>{const boneRx=/^(Hip bone|Femur|Patella|Tibia|Fibula|Sacrum|Coccyx|Calcaneus|Talus)$/;
   const bones=meshes.filter(m=>m.userData.c&&/oseo/.test(m.userData.sys||'')&&boneRx.test(m.userData.c.en)&&m.visible!==false);
   const cs=0.008,H=new Map(),key=(x,y,z)=>((Math.floor(x/cs)*73856093)^(Math.floor(y/cs)*19349663)^(Math.floor(z/cs)*83492791));
   for(const m of bones){const P=m.geometry.attributes.position.array,N=m.geometry.attributes.normal.array;for(let i=0;i<P.length;i+=3){const k=key(P[i],P[i+1],P[i+2]);let b=H.get(k);if(!b)H.set(k,b=[]);b.push(P[i],P[i+1],P[i+2],N[i],N[i+1],N[i+2]);}}
   const out={};for(const m of meshes){const c=m.userData.c;if(!c||m.userData.sys!=='muscular'||m.visible===false||c.side!=='derecho')continue;
     if(!/Vastus|Rectus femoris|Gluteus|biceps femoris|Semitend|Semimemb|Adductor|gastrocnemius|Soleus|Sartorius|Gracilis|Tensor fasciae|Iliacus|Psoas|Tibialis/.test(c.en))continue;
     const P=m.geometry.attributes.position.array,n=P.length/3;let ins=0;
     for(let i=0;i<n;i++){const x=P[i*3],y=P[i*3+1],z=P[i*3+2],fx=Math.floor(x/cs),fy=Math.floor(y/cs),fz=Math.floor(z/cs);let bd=1e9,bb=null,bo=0;
       for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let d=-1;d<=1;d++){const L=H.get(((fx+a)*73856093)^((fy+b)*19349663)^((fz+d)*83492791));if(!L)continue;for(let t=0;t<L.length;t+=6){const q=(L[t]-x)**2+(L[t+1]-y)**2+(L[t+2]-z)**2;if(q<bd){bd=q;bb=L;bo=t;}}}
       if(bb){const dot=(x-bb[bo])*bb[bo+3]+(y-bb[bo+1])*bb[bo+4]+(z-bb[bo+2])*bb[bo+5];if(dot<-0.003)ins++;}}
     out[c.en]=+(100*ins/n).toFixed(1);}return out;};
 /* verdad de terreno: vértices reales de la malla (punto más bajo del calcáneo, cabeza del 1.er y 5.º metatarsiano, punta del primer dedo) */
 const bone=(n,S)=>meshes.find(m=>m.userData.c&&m.userData.c.en===n&&m.userData.c.side===(S==='R'?'derecho':'izquierdo'));
 const pick=(m,f)=>{const R=m.userData.rest||m.geometry.attributes.position.array;let bi=0,bv=-1e9;for(let i=0;i<R.length;i+=3){const v=f(R[i],R[i+1],R[i+2]);if(v>bv){bv=v;bi=i/3;}}return bi;};
 const MK=[];for(const S of ['R','L']){const sl=S==='R'?-1:1;
   const ca=bone('Calcaneus',S),m1=bone('First metatarsal bone',S),m5=bone('Fifth metatarsal bone',S),h1=bone('Distal phalanx of first finger of foot',S);
   if(ca)MK.push(['talon_'+S,ca,pick(ca,(x,y,z)=>-y-0.3*z)]);if(m1)MK.push(['meta1_'+S,m1,pick(m1,(x,y,z)=>-y+0.5*z)]);if(m5)MK.push(['meta5_'+S,m5,pick(m5,(x,y,z)=>-y+0.5*z)]);if(h1)MK.push(['dedo1_'+S,h1,pick(h1,(x,y,z)=>z)]);}
 const mk=()=>{const o={};for(const [n,m,i] of MK){const P=m.geometry.attributes.position.array;o[n]=new V3(P[i*3],P[i*3+1],P[i*3+2]).applyMatrix4(m.matrixWorld);}return o;};
 SQ.p=0;sqUpdate();const o0=pts();const m0=mk();const rest=inBone();
 const B=SQ.bottom,res={depth:SQ.depth,profile:sqProf(),bottom:{K:+B.K.toFixed(0),H:+B.H.toFixed(0),A:+B.A.toFixed(0),trunk:+B.tau.toFixed(0),lumbar:+B.L.toFixed(1),thigh:+B.th.toFixed(0),warn:B.warn,limit:B.limit},frames:{}};
 for(const pp of [26,50,74]){SQ.p=pp;sqUpdate();const o=pts();let sl=0,li=0;for(const k of ['heelR','toeR','heelL','toeL','latR','latL']){const d=o[k].clone().sub(o0[k]);sl=Math.max(sl,Math.hypot(d.x,d.z));li=Math.max(li,Math.abs(d.y));}
   const off=S=>{const h=o['heel'+S],t=o['toe'+S],k=o['knee'+S];const d=t.clone().sub(h);d.y=0;d.normalize();const v=k.clone().sub(h);return +((v.x*d.z-v.z*d.x)*(S==='R'?1:-1)*1000).toFixed(0);};
   const mm=mk();let msl=0,mli=0,worst='';for(const k in m0){const d=mm[k].clone().sub(m0[k]);const h=Math.hypot(d.x,d.z);if(h>msl){msl=h;worst=k;}mli=Math.max(mli,Math.abs(d.y));}
   let nan=0;for(const m of meshes){if(!m.visible)continue;const a=m.geometry.attributes.position.array;for(let i=0;i<a.length;i+=97)if(!isFinite(a[i]))nan++;}
   res.frames[pp]={footSlide_mm:+(sl*1000).toFixed(1),footLift_mm:+(li*1000).toFixed(1),meshFootSlide_mm:+(msl*1000).toFixed(1),meshFootLift_mm:+(mli*1000).toFixed(1),worstMarker:worst,kneeOut_R_mm:off('R'),kneeOut_L_mm:off('L'),
     thighFromHoriz:+(Math.atan2(o.hipR.y-o.kneeR.y,Math.hypot(o.hipR.x-o.kneeR.x,o.hipR.z-o.kneeR.z))*180/Math.PI).toFixed(1),
     K:+SQ.cur.K.toFixed(0),H:+SQ.cur.H.toFixed(0),A:+SQ.cur.A.toFixed(0),trunk:+SQ.cur.tau.toFixed(0),com_mm:+((sqCOM(SQ.cur.K,SQ.cur.A,SQ.cur.H,SQ.cur.L)-sqGeo().foot)*1000).toFixed(1),nan};}
 SQ.p=50;sqUpdate();const bot=inBone();
 res.muscleInBone=Object.keys(bot).map(k=>[k,rest[k],bot[k],+(bot[k]-rest[k]).toFixed(1)]).sort((a,b)=>b[3]-a[3]).slice(0,10);
 return res;})()`);
const views = [['frontal',0,1.5],['posterior',Math.PI,1.5],['lateral_d',-Math.PI/2,1.5],['lateral_i',Math.PI/2,1.5],['tres_cuartos',-0.75,1.35]];
for (const pp of [0,26,50,74]) {
  E(`SQ.p=${pp};sqUpdate();`);
  for (const [n,th,ph] of views) {
    E(`orb.th=orb.T.th=${th};orb.ph=orb.T.ph=${ph};orb.r=orb.T.r=3.4;orb.tgt.set(0,0.78,0.08);orb.T.tgt.set(0,0.78,0.08);`);
    await shot(`sq_${depth}_${String(pp).padStart(2,'0')}_${n}`);
  }
}
E(`SQ.p=50;sqUpdate();`);
for (const [n,th,ph,tgt,r] of [['rodilla_lat',-Math.PI/2,1.5,'-0.1,0.4,0.15',1.0],['rodilla_front',0,1.5,'0,0.4,0.2',1.0],['cadera_post',Math.PI,1.3,'0,0.45,-0.15',1.1]]) {
  E(`orb.th=orb.T.th=${th};orb.ph=orb.T.ph=${ph};orb.r=orb.T.r=${r};orb.tgt.set(${tgt});orb.T.tgt.set(${tgt});`);
  await shot(`sq_${depth}_zoom_${n}`);
}
return metrics;
