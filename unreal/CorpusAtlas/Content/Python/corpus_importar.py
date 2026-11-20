# -*- coding: utf-8 -*-
"""Corpus Atlas → Unreal: importa los GLB, activa Nanite, crea los materiales y el mapa.

Antes, en la raíz del repositorio:   node tools/unreal/exportar.js
Después, en el editor de Unreal (Ventana → Registro de salida → consola Python):

    import corpus_importar as ci
    ci.todo()            # todo de una vez
    # o por partes:
    ci.copiar_datos(); ci.crear_materiales(); ci.importar_mallas(); ci.crear_mapa()

Las mallas quedan en /Game/Corpus/Mallas/<cuerpo>/<sistema>/<id>, los materiales en /Game/Corpus/Materiales
y el mapa en /Game/Corpus/Mapas/Atlas.

Material de tejido (M_CorpusTejido), a partir de lo que ya lleva cada vértice:
  color R = oclusión ambiental · G = tendón/aponeurosis · B = cartílago articular
  tangente = dirección de la fibra muscular (o del eje del vaso/nervio)
  → estrías de fibra en relieve a dos escalas, brillo anisótropo húmedo a lo largo de la fibra,
    tendón nacarado, cartílago liso azulado, dispersión bajo la superficie y poro fino en el hueso.
Datos primitivos por pieza: 0–2 color de estado, 3 fuerza del estado, 4 opacidad, 5–7 color propio del órgano, 8 su peso.
"""
import json
import os
import shutil

import unreal

PROY = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
IMPORTAR = os.path.join(PROY, "Importar")
DATOS = os.path.join(PROY, "Content", "Datos")
R_MALLAS = "/Game/Corpus/Mallas"
R_MAT = "/Game/Corpus/Materiales"
R_MAPA = "/Game/Corpus/Mapas/Atlas"

mel = unreal.MaterialEditingLibrary
eal = unreal.EditorAssetLibrary
herr = unreal.AssetToolsHelpers.get_asset_tools()


def _hex(h):
    """Color sRGB «rrggbb» → lineal."""
    def lin(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return unreal.LinearColor(lin(int(h[0:2], 16)), lin(int(h[2:4], 16)), lin(int(h[4:6], 16)), 1.0)


# Tejidos: color base (el de la capa en la web) y carácter de la superficie.
#   fibra: relieve de las estrías · anis: brillo alargado · sss: dispersión bajo la superficie · poro: grano fino
TEJIDOS = {
    "oseo":                dict(color="ece2cb", rug=0.62, esp=0.35, fibra=0.00, anis=0.0, sss=0.10, sss_color="e8c9a0", poro=0.55, esc=0.0),
    "muscular":            dict(color="a3392f", rug=0.38, esp=0.55, fibra=0.85, anis=0.55, sss=0.45, sss_color="7a1410", poro=0.10, esc=9.0),
    "articular":           dict(color="d3dde6", rug=0.30, esp=0.60, fibra=0.55, anis=0.70, sss=0.30, sss_color="c8d6e8", poro=0.05, esc=14.0),
    "insercion":           dict(color="2f9e5b", rug=0.55, esp=0.30, fibra=0.00, anis=0.0, sss=0.05, sss_color="2f9e5b", poro=0.00, esc=0.0),
    "fascia":              dict(color="cdb594", rug=0.35, esp=0.55, fibra=0.35, anis=0.50, sss=0.35, sss_color="d8c4a8", poro=0.05, esc=16.0),
    "bolsas":              dict(color="8fb7c9", rug=0.20, esp=0.70, fibra=0.00, anis=0.0, sss=0.50, sss_color="9cc4d8", poro=0.00, esc=0.0),
    "arterial":            dict(color="c53a2f", rug=0.28, esp=0.60, fibra=0.12, anis=0.30, sss=0.40, sss_color="8a1510", poro=0.00, esc=20.0),
    "venoso":              dict(color="3f62ad", rug=0.30, esp=0.60, fibra=0.10, anis=0.30, sss=0.40, sss_color="1c2f6a", poro=0.00, esc=20.0),
    "linfatico":           dict(color="6aa874", rug=0.35, esp=0.50, fibra=0.00, anis=0.0, sss=0.40, sss_color="4f8a5a", poro=0.05, esc=0.0),
    "nervioso_central":    dict(color="e6c4b0", rug=0.32, esp=0.55, fibra=0.00, anis=0.0, sss=0.60, sss_color="d89a86", poro=0.05, esc=0.0),
    "nervioso_periferico": dict(color="e3c23f", rug=0.40, esp=0.45, fibra=0.30, anis=0.45, sss=0.30, sss_color="c9a020", poro=0.00, esc=24.0),
    "respiratorio":        dict(color="d99b9b", rug=0.40, esp=0.50, fibra=0.00, anis=0.0, sss=0.55, sss_color="b85c5c", poro=0.25, esc=0.0),
    "digestivo":           dict(color="c98b67", rug=0.30, esp=0.60, fibra=0.00, anis=0.0, sss=0.55, sss_color="a0502c", poro=0.05, esc=0.0),
    "urinario":            dict(color="a65d4c", rug=0.32, esp=0.55, fibra=0.00, anis=0.0, sss=0.50, sss_color="7a2c1c", poro=0.05, esc=0.0),
    "reproductor":         dict(color="c48aa0", rug=0.35, esp=0.50, fibra=0.00, anis=0.0, sss=0.50, sss_color="a0506a", poro=0.05, esc=0.0),
    "endocrino":           dict(color="9a6bc2", rug=0.35, esp=0.50, fibra=0.00, anis=0.0, sss=0.45, sss_color="6a3c94", poro=0.10, esc=0.0),
    "piel":                dict(color="d29f82", rug=0.50, esp=0.40, fibra=0.00, anis=0.0, sss=0.60, sss_color="c2543a", poro=0.20, esc=0.0),
}
# Multiplicador del color base tras el tinte del órgano: el hueso (tinte 242,236,220) quemaba la imagen con la exposición
# del estudio. Comprobado en capturas (unreal/capturas).
ALBEDO = {"oseo": 0.30, "articular": 0.55, "bolsas": 0.80, "fascia": 0.80}
FIBRA = ("muscular", "articular", "fascia", "arterial", "venoso", "nervioso_periferico", "linfatico")


# ───────────────────────── datos ─────────────────────────
def copiar_datos():
    """Copia Importar/datos/*.json y manifiesto.json a Content/Datos (los lee UCorpusDatos)."""
    os.makedirs(DATOS, exist_ok=True)
    n = 0
    origen = os.path.join(IMPORTAR, "datos")
    for f in os.listdir(origen):
        shutil.copy2(os.path.join(origen, f), os.path.join(DATOS, f)); n += 1
    shutil.copy2(os.path.join(IMPORTAR, "manifiesto.json"), os.path.join(DATOS, "manifiesto.json"))
    unreal.log("Corpus: %d archivos de datos copiados a Content/Datos" % (n + 1))


# ───────────────────────── materiales ─────────────────────────
class _G:
    """Ayudante para montar el grafo de un material con pocas líneas."""

    def __init__(self, mat):
        self.m = mat; self.y = -900

    def n(self, clase, x=-800, **props):
        e = mel.create_material_expression(self.m, clase, x, self.y); self.y += 90
        for k, v in props.items():
            e.set_editor_property(k, v)
        return e

    def une(self, a, b, entrada, salida=""):
        if not mel.connect_material_expressions(a, salida, b, entrada):
            unreal.log_warning("Corpus: no se pudo unir %s.%s → %s.%s en %s" % (a.get_class().get_name(), salida,
                               b.get_class().get_name(), entrada, self.m.get_name()))

    def op(self, clase, a, b, x=-400, **props):
        e = self.n(clase, x, **props)
        self.une(a, e, "A"); self.une(b, e, "B")
        return e

    def un(self, clase, a, x=-400):
        """Nodo de una sola entrada (Abs, Saturate, DDX…): su entrada no tiene nombre en 5.8."""
        e = self.n(clase, x); self.une(a, e, ""); return e

    def mul(self, a, b): return self.op(unreal.MaterialExpressionMultiply, a, b)
    def add(self, a, b): return self.op(unreal.MaterialExpressionAdd, a, b)

    def lerp(self, a, b, alfa):
        e = self.n(unreal.MaterialExpressionLinearInterpolate, -300)
        self.une(a, e, "A"); self.une(b, e, "B"); self.une(alfa, e, "Alpha"); return e

    def esc(self, nombre, valor, cpd=None):
        e = self.n(unreal.MaterialExpressionScalarParameter, parameter_name=nombre, default_value=valor)
        if cpd is not None:
            e.set_editor_property("use_custom_primitive_data", True); e.set_editor_property("primitive_data_index", cpd)
        return e

    def vec(self, nombre, color, cpd=None):
        e = self.n(unreal.MaterialExpressionVectorParameter, parameter_name=nombre, default_value=color)
        if cpd is not None:
            e.set_editor_property("use_custom_primitive_data", True); e.set_editor_property("primitive_data_index", cpd)
        return e

    def cte(self, v): return self.n(unreal.MaterialExpressionConstant, r=v)
    def sal(self, e, prop, salida=""): mel.connect_material_property(e, salida, prop)


def _maestro(nombre, translucido):
    ruta = "%s/%s" % (R_MAT, nombre)
    if eal.does_asset_exist(ruta):
        # Se rehace en el mismo recurso: las instancias y mallas que lo usan siguen apuntando a él
        mat = eal.load_asset(ruta)
        mel.delete_all_material_expressions(mat)
    else:
        mat = herr.create_asset(nombre, R_MAT, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property("two_sided", True)
    if translucido:
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        # volumétrica: recibe luz de todas las fuentes (con «superficie por píxel» la piel salía negra)
        mat.set_editor_property("translucency_lighting_mode", unreal.TranslucencyLightingMode.TLM_VOLUMETRIC_PER_VERTEX_DIRECTIONAL)
    else:
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_SUBSURFACE)
    g = _G(mat)
    MP = unreal.MaterialProperty

    vc = g.n(unreal.MaterialExpressionVertexColor)               # R oclusión, G tendón, B cartílago
    base = g.vec("ColorBase", _hex("a3392f"))
    tendon = g.vec("ColorTendon", _hex("efe6d6"))                # nacarado
    cartil = g.vec("ColorCartilago", _hex("c9d7dd"))             # hialino azulado
    estado = g.vec("Estado", unreal.LinearColor(0, 0, 0, 0), cpd=0)   # selección, agonistas, actividad…
    rug = g.esc("Rugosidad", 0.4); esp = g.esc("Especular", 0.5)
    fibra = g.esc("Fibra", 0.8); escala = g.esc("EscalaFibra", 9.0)
    anis = g.esc("Anisotropia", 0.5); poro = g.esc("Poro", 0.1)
    sss = g.esc("Dispersion", 0.4); sss_c = g.vec("ColorDispersion", _hex("7a1410"))

    # Coordenada a través de la fibra = posición local · (normal × tangente). Las estrías corren a lo largo de la tangente.
    pos = g.n(unreal.MaterialExpressionLocalPosition) if hasattr(unreal, "MaterialExpressionLocalPosition") else g.n(unreal.MaterialExpressionWorldPosition)
    nrm = g.n(unreal.MaterialExpressionVertexNormalWS)
    tan = g.n(unreal.MaterialExpressionVertexTangentWS)
    bit = g.op(unreal.MaterialExpressionCrossProduct, nrm, tan)
    u = g.op(unreal.MaterialExpressionDotProduct, pos, bit)
    fase = g.mul(u, escala)                                      # ciclos por centímetro
    s1 = g.n(unreal.MaterialExpressionSine, -400, period=1.0); g.une(fase, s1, "")
    f2 = g.mul(fase, g.cte(2.3))                                 # 3.7 producía muaré al acercarse
    s2 = g.n(unreal.MaterialExpressionSine, -400, period=1.0); g.une(f2, s2, "")
    # Antimuaré: ciclos de estría por píxel (|ddx| + |ddy| de la fase). Cada escala se apaga entre 0,25 y 0,5 ciclos
    # por píxel, antes de que el muestreo la convierta en franjas (a cuerpo entero hay >1 ciclo por píxel).
    cpp = g.add(g.un(unreal.MaterialExpressionAbs, g.un(unreal.MaterialExpressionDDX, fase)),
                g.un(unreal.MaterialExpressionAbs, g.un(unreal.MaterialExpressionDDY, fase)))
    v1 = g.un(unreal.MaterialExpressionSaturate, g.add(g.cte(2.0), g.mul(cpp, g.cte(-4.0))))
    v2 = g.un(unreal.MaterialExpressionSaturate, g.add(g.cte(2.0), g.mul(cpp, g.cte(-9.2))))
    onda = g.add(g.mul(s1, v1), g.mul(g.mul(s2, v2), g.cte(0.35)))   # fascículos gruesos + fibras finas

    # Grano fino (poro del hueso, irregularidad del tejido): ruido 3D barato
    ruido = g.n(unreal.MaterialExpressionNoise, -400, scale=6.0, levels=2, output_min=-1.0, output_max=1.0)
    g.une(pos, ruido, "")     # primera entrada del ruido = posición («Position» no existe con ese nombre en 5.8)
    grano = g.mul(ruido, poro)

    # Máscaras por vértice; el cartílago articular no lleva estrías
    mB = g.n(unreal.MaterialExpressionComponentMask, -600, r=False, g=False, b=True, a=False); g.une(vc, mB, "")
    mG = g.n(unreal.MaterialExpressionComponentMask, -600, r=False, g=True, b=False, a=False); g.une(vc, mG, "")
    mR = g.n(unreal.MaterialExpressionComponentMask, -600, r=True, g=False, b=False, a=False); g.une(vc, mR, "")
    noCart = g.n(unreal.MaterialExpressionOneMinus, -500); g.une(mB, noCart, "")
    fuerza = g.mul(fibra, noCart)

    # Color: base → tendón (G) → cartílago (B); las estrías oscurecen los surcos; la oclusión sombrea los pliegues
    # Color propio del órgano (tablas TINT de la web, en el manifiesto): se mezcla con el de la capa según su peso
    tinte = g.vec("Tinte", unreal.LinearColor(0, 0, 0, 0), cpd=5)
    tRGB = g.n(unreal.MaterialExpressionComponentMask, -500, r=True, g=True, b=True, a=False); g.une(tinte, tRGB, "")
    # La salida por defecto de un VectorParameter es RGB (3 componentes): el alfa se toma de su salida «A»
    tA = g.n(unreal.MaterialExpressionComponentMask, -500, r=True, g=False, b=False, a=False); g.une(tinte, tA, "", "A")
    base = g.lerp(base, tRGB, tA)
    col = g.lerp(base, tendon, mG)
    col = g.lerp(col, cartil, mB)
    col = g.mul(col, g.esc("Albedo", 1.0))                       # los tejidos casi blancos (hueso, cartílago) saturaban la imagen
    surco = g.add(g.cte(1.0), g.mul(g.mul(onda, fuerza), g.cte(0.10)))
    col = g.mul(col, surco)
    col = g.mul(col, g.add(g.cte(1.0), g.mul(grano, g.cte(0.25))))
    ao = g.lerp(g.cte(0.45), g.cte(1.0), mR)
    col = g.mul(col, ao)
    eRGB = g.n(unreal.MaterialExpressionComponentMask, -500, r=True, g=True, b=True, a=False); g.une(estado, eRGB, "")
    eA = g.n(unreal.MaterialExpressionComponentMask, -500, r=True, g=False, b=False, a=False); g.une(estado, eA, "", "A")
    col = g.lerp(col, eRGB, eA)
    g.sal(col, MP.MP_BASE_COLOR)
    brillo = g.mul(eRGB, g.mul(eA, g.cte(0.35)))                 # el estado brilla un poco: se lee en sombra
    if translucido:          # la capa translúcida recibe poca luz: un velo de su propio color la hace legible
        brillo = g.add(brillo, g.mul(col, g.cte(0.35)))
    g.sal(brillo, MP.MP_EMISSIVE_COLOR)

    # Relieve en espacio tangente: X = fibra, Y = a través. La pendiente de la onda inclina la normal en Y.
    c1 = g.n(unreal.MaterialExpressionCosine, -400, period=1.0); g.une(fase, c1, "")
    pend = g.mul(g.mul(g.mul(c1, v1), fuerza), g.cte(0.22))                # relieve suave: con 0.45 las estrías brillaban como rayas
    pend = g.add(pend, g.mul(grano, g.cte(0.6)))
    normal = g.n(unreal.MaterialExpressionAppendVector, -300)
    xy = g.n(unreal.MaterialExpressionAppendVector, -350); g.une(g.mul(grano, g.cte(0.4)), xy, "A"); g.une(pend, xy, "B")
    g.une(xy, normal, "A"); g.une(g.cte(1.0), normal, "B")
    nn = g.n(unreal.MaterialExpressionNormalize, -250); g.une(normal, nn, "VectorInput")
    if not translucido:      # en translúcido la normal en espacio tangente y la anisotropía dejaban la superficie negra
        g.sal(nn, MP.MP_NORMAL)

    # Superficie húmeda: el tendón y el cartílago son más lisos; los surcos, algo más mates
    r = g.lerp(rug, g.cte(0.22), mG)
    r = g.lerp(r, g.cte(0.16), mB)
    r = g.add(r, g.mul(g.mul(onda, fuerza), g.cte(-0.05)))
    g.sal(r, MP.MP_ROUGHNESS)
    g.sal(esp, MP.MP_SPECULAR)
    if not translucido:
        g.sal(g.mul(anis, noCart), MP.MP_ANISOTROPY)
    g.sal(g.mul(mR, g.cte(1.0)), MP.MP_AMBIENT_OCCLUSION)

    opac = g.esc("Opacidad", 1.0, cpd=4)
    if translucido:
        g.sal(opac, MP.MP_OPACITY)
    else:
        g.sal(sss, MP.MP_OPACITY)                 # en el modelo Subsurface, la opacidad regula la dispersión
        g.sal(sss_c, MP.MP_SUBSURFACE_COLOR)

    mel.layout_material_expressions(mat)
    mel.recompile_material(mat)
    eal.save_asset(ruta)
    return mat


def crear_materiales():
    """M_CorpusTejido (opaco, dispersión) y M_CorpusTranslucido, más una instancia por tejido: MI_<capa> y MI_<capa>_T."""
    eal.make_directory(R_MAT)
    maestros = {"": _maestro("M_CorpusTejido", False), "_T": _maestro("M_CorpusTranslucido", True)}
    for clave, t in TEJIDOS.items():
        for suf, padre in maestros.items():
            nombre = "MI_%s%s" % (clave, suf)
            ruta = "%s/%s" % (R_MAT, nombre)
            if eal.does_asset_exist(ruta):
                mi = eal.load_asset(ruta)
            else:
                mi = herr.create_asset(nombre, R_MAT, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
            mel.set_material_instance_parent(mi, padre)
            mel.set_material_instance_vector_parameter_value(mi, "ColorBase", _hex(t["color"]))
            mel.set_material_instance_vector_parameter_value(mi, "ColorDispersion", _hex(t["sss_color"]))
            for p, k in (("Rugosidad", "rug"), ("Especular", "esp"), ("Fibra", "fibra"), ("Anisotropia", "anis"),
                         ("Dispersion", "sss"), ("Poro", "poro"), ("EscalaFibra", "esc")):
                mel.set_material_instance_scalar_parameter_value(mi, p, float(t[k]))
            mel.set_material_instance_scalar_parameter_value(mi, "Albedo", float(ALBEDO.get(clave, 1.0)))
            eal.save_asset(ruta)
    unreal.log("Corpus: materiales creados en " + R_MAT)


# ───────────────────────── mallas ─────────────────────────
def _ajustar(malla, con_fibra):
    """Normales y tangentes tal como vienen, Nanite, y colisión por triángulos (para seleccionar con el ratón)."""
    sub = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    try:
        b = sub.get_lod_build_settings(malla, 0)
        b.set_editor_property("recompute_normals", False)
        b.set_editor_property("recompute_tangents", False)
        b.set_editor_property("generate_lightmap_u_vs", False)
        b.set_editor_property("remove_degenerates", False)
        sub.set_lod_build_settings(malla, 0, b)
    except Exception as e:  # noqa
        unreal.log_warning("Corpus: ajustes de construcción de %s: %s" % (malla.get_name(), e))
    try:
        ns = malla.get_editor_property("nanite_settings")
        ns.set_editor_property("enabled", True)
        if con_fibra:
            try:
                ns.set_editor_property("explicit_tangents", True)   # Nanite: conservar la tangente = dirección de fibra
            except Exception:
                pass
        sub.set_nanite_settings(malla, ns, True)
    except Exception as e:  # noqa
        unreal.log_warning("Corpus: Nanite en %s: %s" % (malla.get_name(), e))
    try:
        bs = malla.get_editor_property("body_setup")
        bs.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    except Exception:
        pass


def _ids_capa(man, archivo):
    """Ids de las piezas que el manifiesto pone en ese cuerpo y esa capa."""
    c, s = archivo["cuerpo"], archivo["sistema"]
    return [i for i, b in man["piezas"].items() if c in b and b[c].get("s") == s]


def _aplanar(destino, ids=None):
    """Interchange (UE 5.x) deja cada malla en <destino>/<archivo>/StaticMeshes/<id>; el C++ la busca en <destino>/<id>.
    Con un archivo de una sola malla, Interchange la llama como el archivo (vh/f_piel → «f_piel» en vez de «f0»):
    si se pasan los ids de la capa, la malla que no coincide con ninguno toma el único id que falta."""
    movidas = 0
    ids = set(ids or [])
    for ruta in eal.list_assets(destino, recursive=True, include_folder=False):
        obj = eal.find_asset_data(ruta)
        if obj.asset_class_path.asset_name != "StaticMesh":
            continue
        carpeta = str(obj.package_path)
        nombre = str(obj.asset_name)
        if ids and nombre not in ids:
            faltan = [i for i in ids if not eal.does_asset_exist("%s/%s" % (destino, i))]
            if len(faltan) == 1:
                nombre = faltan[0]
        if carpeta == destino and nombre == str(obj.asset_name):
            continue
        if not eal.does_asset_exist("%s/%s" % (destino, nombre)):
            if eal.rename_asset(ruta.split(".")[0], "%s/%s" % (destino, nombre)):
                movidas += 1
    for sub in eal.list_assets(destino, recursive=False, include_folder=True):
        if sub.endswith("/") and sub.rstrip("/") != destino:
            eal.delete_directory(sub.rstrip("/"))   # quedan redirectores y texturas de relleno sin usar
    return movidas


def aplanar_mallas():
    """Mueve todas las mallas ya importadas a /Game/Corpus/Mallas/<cuerpo>/<sistema>/<id>."""
    man = json.load(open(os.path.join(IMPORTAR, "manifiesto.json"), encoding="utf-8"))
    for a in man["archivos"]:
        destino = "%s/%s/%s" % (R_MALLAS, a["cuerpo"], a["sistema"])
        n = _aplanar(destino, _ids_capa(man, a))
        unreal.log("Corpus: %s → %d mallas movidas a %s" % (a["archivo"], n, destino))


def ajustar_mallas():
    """Vuelve a aplicar Nanite, tangentes y colisión a las mallas ya importadas (necesita el editor completo:
    en modo comando no existe StaticMeshEditorSubsystem)."""
    if unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem) is None:
        unreal.log_error("Corpus: ajustar_mallas necesita el editor completo (no el modo comando)")
        return
    man = json.load(open(os.path.join(IMPORTAR, "manifiesto.json"), encoding="utf-8"))
    with unreal.ScopedSlowTask(len(man["archivos"]), "Corpus: Nanite") as barra:
        barra.make_dialog(True)
        for a in man["archivos"]:
            barra.enter_progress_frame(1, a["archivo"])
            destino = "%s/%s/%s" % (R_MALLAS, a["cuerpo"], a["sistema"])
            n = 0
            for ruta in eal.list_assets(destino, recursive=True, include_folder=False):
                obj = eal.load_asset(ruta)
                if isinstance(obj, unreal.StaticMesh):
                    _ajustar(obj, a["base"] in FIBRA); n += 1
            eal.save_directory(destino, only_if_is_dirty=True, recursive=True)
            unreal.log("Corpus: Nanite %s → %d mallas" % (a["archivo"], n))


def _opciones_interchange():
    """Interchange: el color por vértice (oclusión, tendón, cartílago) debe importarse tal cual, sin texturas ni materiales."""
    p = unreal.InterchangeGenericAssetsPipeline()
    try:
        mp = p.get_editor_property("mesh_pipeline")
        mp.set_editor_property("vertex_color_import_option", unreal.InterchangeVertexColorImportOption.IVCIO_REPLACE)
        mp.set_editor_property("keep_sections_separate", False)
        mp.set_editor_property("build_nanite", True)
        mp.set_editor_property("recompute_normals", False)
        mp.set_editor_property("recompute_tangents", False)
        mp.set_editor_property("combine_static_meshes", False)
    except Exception as e:  # noqa
        unreal.log_warning("Corpus: opciones de malla de Interchange: %s" % e)
    try:
        mat = p.get_editor_property("material_pipeline")
        mat.set_editor_property("import_materials", False)
    except Exception as e:  # noqa
        unreal.log_warning("Corpus: opciones de material de Interchange: %s" % e)
    return p


def importar_mallas(solo=None):
    """Importa Importar/<cuerpo>/<sistema>.glb. `solo` = lista de «cuerpo/sistema» para importar solo algunos."""
    man = json.load(open(os.path.join(IMPORTAR, "manifiesto.json"), encoding="utf-8"))
    archivos = [a for a in man["archivos"] if not solo or ("%s/%s" % (a["cuerpo"], a["sistema"])) in solo]
    with unreal.ScopedSlowTask(len(archivos), "Corpus: importando mallas") as barra:
        barra.make_dialog(True)
        for a in archivos:
            if barra.should_cancel():
                break
            barra.enter_progress_frame(1, a["archivo"])
            destino = "%s/%s/%s" % (R_MALLAS, a["cuerpo"], a["sistema"])
            t = unreal.AssetImportTask()
            t.set_editor_property("filename", os.path.join(IMPORTAR, a["archivo"].replace("/", os.sep)))
            t.set_editor_property("destination_path", destino)
            t.set_editor_property("automated", True)
            t.set_editor_property("replace_existing", True)
            t.set_editor_property("save", False)
            t.set_editor_property("options", _opciones_interchange())
            herr.import_asset_tasks([t])
            _aplanar(destino, _ids_capa(man, a))
            con_fibra = a["base"] in FIBRA
            mi = eal.load_asset("%s/MI_%s" % (R_MAT, a["base"] if a["base"] in TEJIDOS else "digestivo"))
            n = 0
            for ruta in eal.list_assets(destino, recursive=True, include_folder=False):
                obj = eal.load_asset(ruta)
                if isinstance(obj, unreal.StaticMesh):
                    _ajustar(obj, con_fibra)
                    if mi:
                        obj.set_material(0, mi)
                    n += 1
                elif isinstance(obj, (unreal.Material, unreal.MaterialInstanceConstant)) and ruta.startswith(R_MALLAS):
                    eal.delete_asset(ruta.split(".")[0])      # el material de relleno del GLB no hace falta
            eal.save_directory(destino, only_if_is_dirty=True, recursive=True)
            unreal.log("Corpus: %s → %d mallas (esperadas %d)" % (a["archivo"], n, a["piezas"]))


# ───────────────────────── mapa ─────────────────────────
# Compensación de exposición manual (pasos sobre la cámara física por defecto, EV100 ≈ 10).
# 10.5 dejaba la imagen blanca: las luces del estudio dan ~1.000 lux, que piden EV ≈ 9.
# Intensidades del estudio: sol en lux, rectangulares en candelas, cielo multiplicador. Con sol=6 el sol no aportaba
# nada y las dos rectangulares (9000 / 14000) quemaban solas el hueso, sin sombreado (capturas de prueba 2026-11-20).
# Ahora el sol es la luz principal y da el relieve; relleno y contraluz quedan suaves.
LUCES = dict(sol=200.0, relleno=2000.0, contra=6000.0, cielo=1.0)
EXPOSICION = 2.0   # comprobado en capturas: 1 queda oscuro, 4 quema los tendones, 2.5 aún satura el hueso


def ajustar_exposicion(valor=None):
    """Cambia la compensación de exposición del volumen de post-proceso del mapa abierto y lo guarda."""
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in actores.get_all_level_actors():
        if isinstance(a, unreal.PostProcessVolume):
            aj = a.get_editor_property("settings")
            aj.set_editor_property("override_auto_exposure_bias", True)
            aj.set_editor_property("auto_exposure_bias", EXPOSICION if valor is None else valor)
            aj.set_editor_property("override_bloom_intensity", True)
            aj.set_editor_property("bloom_intensity", 0.08)
            a.set_editor_property("settings", aj)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()


def ajustar_luces(**cambios):
    """Cambia la intensidad de las luces del mapa abierto (claves de LUCES) y lo guarda. Ej.: ajustar_luces(sol=40, relleno=2000)."""
    LUCES.update(cambios)
    etiquetas = {"Luz principal": ("sol", unreal.DirectionalLightComponent), "Luz de relleno": ("relleno", unreal.RectLightComponent),
                 "Contraluz": ("contra", unreal.RectLightComponent), "Luz de cielo": ("cielo", unreal.SkyLightComponent)}
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in actores.get_all_level_actors():
        e = etiquetas.get(a.get_actor_label())
        if e:
            a.get_component_by_class(e[1]).set_editor_property("intensity", float(LUCES[e[0]]))
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()


def crear_mapa():
    """Estudio oscuro con luz de tres puntos, cielo suave, niebla y post-proceso (exposición fija, oclusión, viñeta)."""
    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    eal.make_directory("/Game/Corpus/Mapas")
    niveles.new_level(R_MAPA)

    def pon(clase, pos=(0, 0, 0), rot=(0, 0, 0), nombre=None):
        a = actores.spawn_actor_from_class(clase, unreal.Vector(*pos), unreal.Rotator(*rot))
        if nombre:
            a.set_actor_label(nombre)
        return a

    # El cuerpo mira hacia +Y y mide ~175 cm de alto. Rotator(roll, pitch, yaw).
    clave = pon(unreal.DirectionalLight, rot=(0, -38, -125), nombre="Luz principal")
    c = clave.get_component_by_class(unreal.DirectionalLightComponent)
    c.set_editor_property("intensity", float(LUCES["sol"])); c.set_editor_property("light_color", unreal.Color(255, 244, 230))
    c.set_editor_property("light_source_angle", 3.0)    # sombras suaves de estudio

    relleno = pon(unreal.RectLight, pos=(-260, 240, 150), rot=(0, -8, -45), nombre="Luz de relleno")
    r = relleno.get_component_by_class(unreal.RectLightComponent)
    r.set_editor_property("intensity", float(LUCES["relleno"])); r.set_editor_property("source_width", 260.0); r.set_editor_property("source_height", 320.0)
    r.set_editor_property("light_color", unreal.Color(214, 228, 255)); r.set_editor_property("attenuation_radius", 1200.0)

    contra = pon(unreal.RectLight, pos=(120, -280, 230), rot=(0, -25, 110), nombre="Contraluz")
    k = contra.get_component_by_class(unreal.RectLightComponent)
    k.set_editor_property("intensity", float(LUCES["contra"])); k.set_editor_property("source_width", 200.0); k.set_editor_property("source_height", 200.0)
    k.set_editor_property("attenuation_radius", 1200.0)   # perfila el contorno de músculos y huesos

    cielo = pon(unreal.SkyLight, nombre="Luz de cielo")
    s = cielo.get_component_by_class(unreal.SkyLightComponent)
    s.set_editor_property("real_time_capture", True); s.set_editor_property("intensity", float(LUCES["cielo"]))
    pon(unreal.SkyAtmosphere, nombre="Atmósfera")
    pon(unreal.ExponentialHeightFog, pos=(0, 0, -50), nombre="Niebla")

    pp = pon(unreal.PostProcessVolume, nombre="Post-proceso")
    pp.set_editor_property("unbound", True)
    aj = pp.get_editor_property("settings")
    for prop, val in (("override_auto_exposure_method", True), ("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL),
                      ("override_auto_exposure_bias", True), ("auto_exposure_bias", EXPOSICION),
                      ("override_vignette_intensity", True), ("vignette_intensity", 0.35),
                      ("override_bloom_intensity", True), ("bloom_intensity", 0.08),   # 0.25 dejaba halo en el hueso
                      ("override_ambient_occlusion_intensity", True), ("ambient_occlusion_intensity", 0.7),
                      ("override_film_toe", True), ("film_toe", 0.6)):
        try:
            aj.set_editor_property(prop, val)
        except Exception as e:  # noqa
            unreal.log_warning("Corpus: post-proceso %s: %s" % (prop, e))
    pp.set_editor_property("settings", aj)

    niveles.save_current_level()
    unreal.log("Corpus: mapa creado en " + R_MAPA)


def todo():
    copiar_datos()
    crear_materiales()
    importar_mallas()
    ajustar_mallas()      # Nanite y tangentes: necesita el editor completo
    crear_mapa()
    unreal.log("Corpus: listo. Pulsa Jugar (Alt+P).")
