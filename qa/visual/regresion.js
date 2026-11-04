// Regresión: sentadilla (pies, rodilla, malla) + marcha + simulador de rango tras los cambios de la v140.
E(`showTab('mov');`);
return E(`(()=>{const res={};const W=p=>p.clone().applyMatrix4(body.matrixWorld);
 const nanCount=()=>{let n=0;for(const m of meshes){if(!m.visible)continue;const a=m.geometry.attributes.position.array;for(let i=0;i<a.length;i+=97)if(!isFinite(a[i]))n++;}return n;};
 for(const d of ['med','par','prof']){if(SQ.on)setSq(false);SQ.prof={sex:'M',age:30,hip:130,knee:138,df:38};setSq(true);SQ.depth=d;SQ.bottom=null;SQ.base=null;SQ.st=null;SQ.lv=null;SQ.play=false;
   const feet=()=>{const R=SQ.root,o=[];for(const S of ['R','L'])for(const k of ['heel','toe'])o.push(W(sqChain(new V3(...RIG[k+'_'+S]),S,R.qs[S])));return o;};
   SQ.p=0;sqUpdate();const f0=feet();let sl=0,li=0,ko=0;
   for(const p of [15,30,40,50,60,75,90]){SQ.p=p;sqUpdate();const f=feet();f.forEach((q,i)=>{const dd=q.clone().sub(f0[i]);sl=Math.max(sl,Math.hypot(dd.x,dd.z));li=Math.max(li,Math.abs(dd.y));});
     if(SQ.cur.K>45){const h=f[0],t=f[1],k=W(sqChain(JOINTS.knee_R.pivot,'R',SQ.root.qs.R,'knee'));const dv=t.clone().sub(h);dv.y=0;dv.normalize();const v=k.clone().sub(h);ko=Math.max(ko,Math.abs((v.x*dv.z-v.z*dv.x)*1000));}}
   res['sentadilla_'+d]={footSlide_mm:+(sl*1000).toFixed(1),footLift_mm:+(li*1000).toFixed(1),kneeOffLineMax_mm:+ko.toFixed(0),nan:nanCount(),K:+SQ.bottom.K.toFixed(0),thigh:+SQ.bottom.th.toFixed(0)};}
 setSq(false);
 // marcha: 4 instantes, sin NaN y con los dos pies moviéndose
 setGait(true);gait.play=false;const g=[];for(const p of [0,25,50,75]){gait.p=p;gaitUpdate();g.push(nanCount());}res.marcha={nan:g,activos:gaitActive().length};setGait(false);
 // simulador de rango: rodilla, hombro y tronco a su máximo
 const rr={};for(const [id,mi] of [['rodilla',0],['hombro',0],['tronco',0]]){const j=ROM.find(x=>x.id===id);curJ=j;curM=j.moves[mi];angle=curM.max;applyPose();rr[id]={max:curM.max,nan:nanCount()};angle=0;applyPose();}
 res.rango=rr;res.bodyIdentity=body.position.length()<1e-9&&Math.abs(body.quaternion.w-1)<1e-9;
 return res;})()`);
