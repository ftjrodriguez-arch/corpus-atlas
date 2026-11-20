# -*- coding: utf-8 -*-
"""Corpus Atlas → Blender: simula un músculo como tejido elástico que sigue a sus huesos sin atravesarlos.

    blender -b --python tools/unreal/blender/simular_musculo.py -- <carpeta de posar.js> [opciones clave=valor]

El músculo arranca en reposo. Sus anclajes (fracción de fibra ≤ 0,03 = origen, ≥ 0,95 = tendón de inserción) siguen la
posición que les da el material de Unreal en cada paso; el resto lo resuelve el solver de tela de Blender: longitud de
las aristas (elasticidad), amortiguación (viscosidad) y colisión contra huesos y músculos profundos, que también se
mueven paso a paso. Sin gravedad. Salida: resultado_<k>.f32 (posiciones por paso, glTF) y una imagen por vista.
Opciones: cuadros=6 (por paso) reposo=25 (cuadros finales) tension=20 flexion=2 presion=0 calidad=8 margen=0.003
"""
import json
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
DIR = args[0]
OP = dict(cuadros=6, reposo=25, tension=20.0, flexion=2.0, presion=0.0, calidad=8, margen=0.003, masa=0.3)
for a in [x for x in args[1:] if "=" in x]:
    k, v = a.split("=")
    OP[k] = type(OP[k])(float(v)) if k in OP else v
info = json.load(open(os.path.join(DIR, "info.json"), encoding="utf-8"))
NP = len(info["pasos"])
f32 = lambda n: np.fromfile(os.path.join(DIR, n), dtype=np.float32)
u32 = lambda n: np.fromfile(os.path.join(DIR, n), dtype=np.uint32)
mus = [f32("musculo_%d.f32" % k) for k in range(NP)]
col = [f32("colision_%d.f32" % k) for k in range(NP)]
w = f32("musculo_w.f32")

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
esc.use_gravity = False


def malla(nombre, pos, idx):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(pos.reshape(-1, 3).tolist(), [], idx.reshape(-1, 3).tolist())
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    esc.collection.objects.link(ob)
    return ob


t0 = time.time()
om = malla("musculo", mus[0], u32("musculo_idx.u32"))
oc = malla("colision", col[0], u32("colision_idx.u32"))
for p in om.data.polygons:
    p.use_smooth = True

# anclajes: origen y tendón de inserción
vg = om.vertex_groups.new(name="ancla")
fijos = np.where((w <= 0.03) | (w >= 0.95))[0]
vg.add(fijos.tolist(), 1.0, "REPLACE")

mc = oc.modifiers.new("colision", "COLLISION")
oc.collision.thickness_outer = OP["margen"]
oc.collision.thickness_inner = 0.01
oc.collision.cloth_friction = 2.0
oc.collision.damping = 0.5

mt = om.modifiers.new("tela", "CLOTH")
c = mt.settings
c.quality = int(OP["calidad"])
c.mass = OP["masa"]
c.tension_stiffness = c.compression_stiffness = c.shear_stiffness = OP["tension"]
c.bending_stiffness = OP["flexion"]
c.tension_damping = c.compression_damping = c.shear_damping = 8.0      # viscosidad: el tejido no rebota
c.bending_damping = 1.0
c.air_damping = 3.0
c.vertex_group_mass = "ancla"
c.pin_stiffness = 1.0
c.effector_weights.gravity = 0.0
if OP["presion"] > 0:
    c.use_pressure = True
    c.uniform_pressure_force = OP["presion"]
    c.use_pressure_volume = True
cc = mt.collision_settings
cc.use_collision = True
cc.distance_min = OP["margen"]
cc.collision_quality = 4
cc.use_self_collision = False

S = int(OP["cuadros"])
total = (NP - 1) * S + int(OP["reposo"])
esc.frame_start = 1
esc.frame_end = total + 1
mt.point_cache.frame_start = 1
mt.point_cache.frame_end = total + 1


def claves(ob, pasos):
    """Una clave de forma por paso, animada en triángulo: entre dos pasos la malla va en línea recta de uno a otro.
    (Cambiar los vértices a mano en cada cuadro no vale: la tela no recoge el cambio y los anclajes no se mueven.)"""
    ob.shape_key_add(name="Basis")
    for k in range(1, len(pasos)):
        sk = ob.shape_key_add(name="p%d" % k)
        sk.data.foreach_set("co", pasos[k])
        for cuadro, valor in (((k - 1) * S + 1, 0.0), (k * S + 1, 1.0), ((k + 1) * S + 1, 0.0 if k < len(pasos) - 1 else 1.0)):
            sk.value = valor
            sk.keyframe_insert("value", frame=cuadro)
    ad = ob.data.shape_keys.animation_data
    if ad and ad.action:
        for fc in getattr(ad.action, "fcurves", []):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


def leer():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = om.evaluated_get(dg)
    out = np.empty(len(ev.data.vertices) * 3, dtype=np.float32)
    ev.data.vertices.foreach_get("co", out)
    return out


bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
claves(om, mus)
claves(oc, col)
res = {0: mus[0].copy()}
SIN = "sinsim" in args
for f in ([] if SIN else range(1, total + 2)):
    esc.frame_set(f)
    k = (f - 1) // S
    if (f - 1) % S == 0 and 0 < k < NP - 1:
        res[k] = leer()
res[NP - 1] = mus[NP - 1].copy() if SIN else leer()
for k, a in res.items():
    a.tofile(os.path.join(DIR, "resultado_%d.f32" % k))
d = (res[NP - 1] - mus[NP - 1]).reshape(-1, 3)
print("SIM %s %s: %d cuadros en %.0f s · anclajes %d de %d · corrección respecto al material: media %.1f mm, máxima %.1f mm"
      % (info["id"], info["en"], total, time.time() - t0, len(fijos), len(w), np.linalg.norm(d, axis=1).mean() * 1000, np.linalg.norm(d, axis=1).max() * 1000))

# imágenes: el resultado y, al lado, lo que hace hoy el material (para comparar)
try:
    esc.render.engine = "BLENDER_WORKBENCH"
    esc.render.resolution_x, esc.render.resolution_y = 1100, 1100
    esc.display.shading.light = "STUDIO"
    esc.display.shading.color_type = "OBJECT"
    esc.display.shading.show_cavity = True
    om.color = (0.75, 0.30, 0.25, 1)
    oc.color = (0.85, 0.82, 0.72, 1)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    esc.collection.objects.link(cam)
    esc.camera = cam
    cam.data.lens = 70
    centro = Vector(np.asarray(res[NP - 1]).reshape(-1, 3).mean(axis=0).tolist())
    lado = -1 if centro.x < 0 else 1
    vistas = {"post": Vector((0.25 * lado, 0.1, -1.7)), "lat": Vector((1.7 * lado, 0.1, -0.2)), "ant": Vector((0.3 * lado, 0.1, 1.7))}
    for nombre, pos_mus in ((("material", mus[NP - 1]),) if SIN else (("sim", res[NP - 1]), ("material", mus[NP - 1]))):
        om.modifiers["tela"].show_viewport = om.modifiers["tela"].show_render = False
        if om.data.shape_keys:
            om.shape_key_clear()
            oc.shape_key_clear()
            oc.data.vertices.foreach_set("co", col[NP - 1])
            oc.data.update()
        om.data.vertices.foreach_set("co", pos_mus)
        om.data.update()
        for v, off in vistas.items():
            cam.location = centro + off
            ade = (centro - cam.location).normalized()          # mirar al centro con la Y del glTF hacia arriba
            der = ade.cross(Vector((0, 1, 0))).normalized()
            arr = der.cross(ade)
            from mathutils import Matrix
            cam.rotation_euler = Matrix((der, arr, -ade)).transposed().to_euler()
            esc.render.filepath = os.path.join(DIR, "%s_%s.png" % (nombre, v))
            bpy.ops.render.render(write_still=True)
    print("SIM imágenes en", DIR)
except Exception as e:  # noqa
    print("SIM sin imágenes:", e)
