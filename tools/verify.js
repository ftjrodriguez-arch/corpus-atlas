const fs=require('fs');const f=require('./draco_decoder.js');
const [, , glb, bin]=process.argv;
f({onModuleLoaded(dm){
  const g=fs.readFileSync(glb);const jl=g.readUInt32LE(12);const js=JSON.parse(g.slice(20,20+jl));const bo=20+jl+8;
  const src=fs.readFileSync(bin);const refd={};let o=4;const orig={};const n=src.readUInt32LE(0);
  for(let k=0;k<n;k++){const nl=src.readUInt32LE(o);o+=4;const id=src.slice(o,o+nl).toString();o+=nl;const nv=src.readUInt32LE(o),nt=src.readUInt32LE(o+4);o+=8;
    const P=new Float32Array(src.buffer.slice(src.byteOffset+o,src.byteOffset+o+nv*12));const I=new Uint32Array(src.buffer.slice(src.byteOffset+o+nv*12,src.byteOffset+o+nv*12+nt*12));const used=new Set(I);const R=[];used.forEach(u=>R.push(P[u*3],P[u*3+1],P[u*3+2]));refd[id]=R;orig[id]={nv,nt};o+=nv*12+nt*12;}
  const dec=new dm.Decoder();let worst=0,tri=0,triO=0;
  js.nodes.forEach((nd,i)=>{const pr=js.meshes[nd.mesh].primitives[0];const bv=js.bufferViews[pr.extensions.KHR_draco_mesh_compression.bufferView];
    const db=new dm.DecoderBuffer();db.Init(new Int8Array(g.buffer,g.byteOffset+bo+bv.byteOffset,bv.byteLength),bv.byteLength);
    const mesh=new dm.Mesh();const st=dec.DecodeBufferToMesh(db,mesh);if(!st.ok())throw new Error('decode '+nd.name);
    tri+=mesh.num_faces();triO+=orig[nd.name].nt;
    const att=dec.GetAttributeByUniqueId(mesh,0);const arr=new dm.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,att,arr);
    // bbox compare
    let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<arr.size();i++){const v=arr.GetValue(i),c=i%3;if(v<mn[c])mn[c]=v;if(v>mx[c])mx[c]=v;}
    const op=orig[nd.name].pos,ot=null;const a={min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9]};{const src2=refd[nd.name];for(let i=0;i<src2.length;i++){const v=src2[i],c=i%3;if(v<a.min[c])a.min[c]=v;if(v>a.max[c])a.max[c]=v;}}for(let c=0;c<3;c++){worst=Math.max(worst,Math.abs(mn[c]-a.min[c]),Math.abs(mx[c]-a.max[c]));}
    dm.destroy(arr);dm.destroy(mesh);dm.destroy(db);});
  console.log('meshes',js.nodes.length,'tris decoded',tri,'original',triO,'max bbox error mm',(worst*1000).toFixed(3));process.exit(0);
}});
