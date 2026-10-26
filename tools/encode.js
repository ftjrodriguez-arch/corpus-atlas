// Encode a region input (.bin) into a glTF binary with KHR_draco_mesh_compression.
const fs = require('fs');
const factory = require('./draco_encoder.js');
const [, , inPath, outPath, qbitsArg] = process.argv;
const QBITS = +(qbitsArg || 14);

factory({ onModuleLoaded(em) {
  const buf = fs.readFileSync(inPath);
  let o = 0;
  const n = buf.readUInt32LE(o); o += 4;
  const bin = [], bufferViews = [], accessors = [], meshes = [], nodes = [];
  let binLen = 0;
  const encoder = new em.Encoder();
  encoder.SetAttributeQuantization(em.POSITION, QBITS);
  encoder.SetAttributeQuantization(em.COLOR, 6);
  encoder.SetSpeedOptions(3, 3);
  encoder.SetEncodingMethod(em.MESH_EDGEBREAKER_ENCODING);
  for (let k = 0; k < n; k++) {
    const nl = buf.readUInt32LE(o); o += 4;
    const id = buf.slice(o, o + nl).toString(); o += nl;
    const nv = buf.readUInt32LE(o), nt = buf.readUInt32LE(o + 4); o += 8;
    const pos = new Float32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + nv * 12)); o += nv * 12;
    const idx = new Uint32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + nt * 12)); o += nt * 12;
    const col = new Uint8Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + nv * 3)); o += nv * 3;
    const mesh = new em.Mesh(), builder = new em.MeshBuilder();
    builder.AddFacesToMesh(mesh, nt, idx);
    const attId = builder.AddFloatAttributeToMesh(mesh, em.POSITION, nv, 3, pos);
    const colId = builder.AddUInt8Attribute(mesh, em.COLOR, nv, 3, col);
    const out = new em.DracoInt8Array();
    const len = encoder.EncodeMeshToDracoBuffer(mesh, out);
    if (!len) { console.error('encode failed', id); em.destroy(out); em.destroy(mesh); em.destroy(builder); continue; }
    const bytes = Buffer.alloc(len);
    for (let i = 0; i < len; i++) bytes[i] = out.GetValue(i) & 255;
    em.destroy(out); em.destroy(mesh); em.destroy(builder);
    // bounds
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { const v = pos[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
    const pad = (4 - (binLen % 4)) % 4; if (pad) { bin.push(Buffer.alloc(pad)); binLen += pad; }
    bufferViews.push({ buffer: 0, byteOffset: binLen, byteLength: len });
    bin.push(bytes); binLen += len;
    accessors.push({ componentType: 5126, count: nv, type: 'VEC3', min: mn, max: mx });
    accessors.push({ componentType: 5121, normalized: true, count: nv, type: 'VEC3' });
    accessors.push({ componentType: nv < 65536 ? 5123 : 5125, count: nt * 3, type: 'SCALAR' });
    meshes.push({ primitives: [{ attributes: { POSITION: accessors.length - 3, COLOR_0: accessors.length - 2 }, indices: accessors.length - 1,
      extensions: { KHR_draco_mesh_compression: { bufferView: bufferViews.length - 1, attributes: { POSITION: attId, COLOR_0: colId } } } }] });
    nodes.push({ name: id, mesh: meshes.length - 1 });
  }
  const gltf = { asset: { version: '2.0', generator: 'Corpus HR (Z-Anatomy, CC BY-SA 4.0)' },
    extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'],
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, accessors, bufferViews, buffers: [{ byteLength: binLen }] };
  let js = Buffer.from(JSON.stringify(gltf), 'utf8'); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  let bb = Buffer.concat(bin); const bp = (4 - (bb.length % 4)) % 4; bb = Buffer.concat([bb, Buffer.alloc(bp)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(outPath, Buffer.concat([head, jh, js, bh, bb]));
  console.log(outPath, nodes.length, 'meshes', (bb.length / 1e6).toFixed(2), 'MB');
  process.exit(0);
} });
