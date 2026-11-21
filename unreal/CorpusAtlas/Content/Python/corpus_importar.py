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
Datos primitivos por pieza: 0–2 color de estado, 3 fuerza del estado, 4 opacidad, 5–7 color propio del órgano, 8 su peso,
12–19 articulaciones que la mueven (movimiento.json; los pesos de cada vértice van en TEXCOORD_0…3).
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
    "muscular":            dict(color="a3392f", rug=0.50, esp=0.35, fibra=0.85, anis=0.55, sss=0.30, sss_color="8a3026", poro=0.10, esc=9.0),
    "articular":           dict(color="d3dde6", rug=0.30, esp=0.60, fibra=0.55, anis=0.70, sss=0.30, sss_color="c8d6e8", poro=0.05, esc=14.0),
    "insercion":           dict(color="2f9e5b", rug=0.55, esp=0.30, fibra=0.00, anis=0.0, sss=0.0, sss_color="000000", poro=0.00, esc=0.0),   # sin dispersión: la verde teñía de naranja el rojo del mapa de orígenes
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
ALBEDO = {"oseo": 0.40, "articular": 0.55, "bolsas": 0.80, "fascia": 0.80}
DESATURAR = {"muscular": 0.24}     # la web se ve salmón, no rojo puro (capturas 2026-11-20)
EMPUJE = {"insercion": 0.06}       # cm hacia fuera: las áreas de origen e inserción no parpadean con el hueso
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


# ───────────────────────── movimiento ─────────────────────────
# De tools/unreal/movimiento.js: cada pieza usa hasta 8 «huecos» de articulación, en el orden en que los aplica deform()
# de la web (de distal a proximal). La articulación de cada hueco va en los datos primitivos 12–19 (± a + 32·b + 1024·c:
# hasta 3 articulaciones seguidas con el mismo peso; negativo = interpolación lineal) y el peso de cada vértice en
# TEXCOORD_0…3 (solo pesos: Nanite promedia los UV al simplificar). La postura (textura de 32×4 que rellena
# ACorpusCuerpo): fila 0 eje + ángulo, fila 1 pivote, fila 2 traslación, todo en glTF (metros, Y arriba).
# Local de Unreal = glTF con Y y Z intercambiados, en centímetros (comprobado con la caja de n1).
HLSL_POSTURA = r"""
// Radio de las costillas en la dirección de p (filas 4… de la textura: altura × sector angular; tools/unreal/torax.js)
struct FTorax
{
    float R(Texture2D T, float3 p)
    {
        float h = clamp((p.y - (@Y0@)) / @DY@, 0, @NH@ - 1);
        int h0 = (int)floor(h), h1 = min(h0 + 1, @NH@ - 1);
        float a = (atan2(p.z - (@ZC@), p.x) + 3.14159265) / 6.2831853 * @NS@ - 0.5;
        float af = floor(a);
        int s0 = (((int)af % @NS@) + @NS@) % @NS@, s1 = (s0 + 1) % @NS@;
        float r0 = lerp(T.Load(int3(s0, 4 + h0, 0)).x, T.Load(int3(s1, 4 + h0, 0)).x, a - af);
        float r1 = lerp(T.Load(int3(s0, 4 + h1, 0)).x, T.Load(int3(s1, 4 + h1, 0)).x, a - af);
        return max(lerp(r0, r1, h - h0), 0.01);
    }
    float K(Texture2D T, float3 p) { return length(float2(p.x, p.z - (@ZC@))) / R(T, p); }
    float3 Gira(float3 p, float3 pv, float4 ea)
    {
        float sn, cs; sincos(ea.w, sn, cs);
        float3 d = p - pv;
        return d * cs + cross(ea.xyz, d) * sn + ea.xyz * dot(ea.xyz, d) * (1 - cs) + pv;
    }
};
FTorax tx;
float3 g = float3(P.x, P.z, P.y) * 0.01;
float3 g0 = g;
float4 qt = float4(0, 0, 0, 1);
float js[9] = { J0, J1, J2, J3, J4, J5, J6, J7, 0 };
float ws[9] = { U0.x, U0.y, U1.x, U1.y, U2.x, U2.y, U3.x, U3.y, 0 };
// Fibra tensa (dorsal ancho, pectoral mayor): el vientre no gira con el hueso; se desplaza y se estira hacia donde va
// su inserción (ip), y solo junto al tendón gira con el húmero. Es el modelo de la web para el pectoral (FIB en deform()).
float3 ip = float3(IX, IY, IZ);
bool fibra = dot(ip, ip) > 0;
bool abrazado = false;
float wl = 0;
// Correctivo elástico (tools/unreal/correctivos.js): los músculos del hombro llevan una rejilla de nodos resuelta fuera
// (anclada a sus huesos, sin atravesarlos). El vértice se mueve con los 8 nodos de su celda: desplazamiento en la mitad
// superior de la textura, giro (para la normal) en la inferior. Texel 0: x = activo, y = fila donde empiezan los giros.
bool rejilla = false;
if (CB > 0.5)
{
    float4 cab = TexC.Load(int3(0, 0, 0));
    if (cab.x > 0.5)
    {
        rejilla = true;
        float3 cn = float3(CNX, CNY, CNZ);
        float3 f = clamp((g0 - float3(COX, COY, COZ)) / CH, 0, cn - 1.001);
        float3 fi = floor(f);
        float3 t = f - fi;
        int nx = (int)CNX, ny = (int)CNY, hq = (int)cab.y;
        int b = (int)CB + (int)fi.x + nx * ((int)fi.y + ny * (int)fi.z);
        float3 d = 0;
        float4 q = 0;
        [unroll] for (int c = 0; c < 8; c++)
        {
            int cx = c & 1, cy = (c >> 1) & 1, cz = (c >> 2) & 1;
            int i = b + cx + nx * (cy + ny * cz);
            float w = (cx ? t.x : 1 - t.x) * (cy ? t.y : 1 - t.y) * (cz ? t.z : 1 - t.z);
            int3 uv = int3(i % @CW@, i / @CW@, 0);
            d += w * TexC.Load(uv).xyz;
            q += w * TexC.Load(uv + int3(0, hq, 0));
        }
        g = g0 + d;
        qt = q;
    }
}
[loop] for (int k = 0; k < 9 && !rejilla; k++)
{
    float jv = js[k];
    int code = (int)round(abs(jv));
    // Antes de girar el tronco (o al acabar): las piezas pegadas al tórax conservan su distancia relativa a las costillas
    // (k = r / radio de las costillas; 1 = sobre ellas). Solo hacia el húmero (peso alto) hay holgura: pliegue axilar.
    bool tronco = (jv == 0) || ((code & 31) >= @NA_TRONCO@);
    if (!abrazado && tronco)
    {
        abrazado = true;
        if (HUG > 0 && wl > 0.0005)
        {
            float k0 = tx.K(Tex, g0);
            float R1 = tx.R(Tex, g);
            float k1 = length(float2(g.x, g.z - (@ZC@))) / R1;
            float libre = saturate((wl - 0.25) / 0.6);
            float l4 = libre * libre * libre * libre;
            float kmax = k0 + (0.006 + libre * libre * 0.07 + libre * 0.03 + l4 * l4 * 1.5) / R1;
            // el límite inferior crece con k0: las dos caras del músculo no se aplastan a la misma altura
            float kmin = k0 < 1 ? k0 : 1 + (k0 - 1) * 0.6;
            // límite suave (tanh): un tope brusco arruga la malla donde unos puntos lo alcanzan y sus vecinos no
            float kt = max(kmin, k1 > k0 ? k0 + (kmax - k0) * tanh((k1 - k0) / (kmax - k0)) : k1);
            float hy = (g.y - (@Y0@)) / @DY@;
            float val = saturate(hy) * saturate(@NH@ - 1 - hy) * saturate(HUG);
            float s = lerp(1, kt / max(k1, 1e-4), val);
            g.x *= s;
            g.z = (@ZC@) + (g.z - (@ZC@)) * s;
            // El borde superior del dorsal cubre el ángulo inferior de la escápula, que resbala por debajo al rotar:
            // las dos caras suben lo mismo, lo justo para quedar por fuera de la punta en esta postura.
            if (HUG > 1.5)
            {
                bool der = g0.x < 0;
                int ja = der ? @ACR_R@ : @ACR_L@, jc = der ? @SC_R@ : @SC_L@;
                float3 b = float3(der ? (@SBX@) : -(@SBX@), @SBY@, @SBZ@);
                b = tx.Gira(b, Tex.Load(int3(ja, 1, 0)).xyz, Tex.Load(int3(ja, 0, 0)));
                b = tx.Gira(b, Tex.Load(int3(jc, 1, 0)).xyz, Tex.Load(int3(jc, 0, 0)));
                float kb = tx.K(Tex, b) + 0.004 / tx.R(Tex, b);
                float kg = tx.K(Tex, g);
                float cerca = 1 - smoothstep(0.04, 0.20, length(g - b));
                float s2 = (kg + cerca * max(0, kb - 1.0)) / max(kg, 1e-4);
                g.x *= s2;
                g.z = (@ZC@) + (g.z - (@ZC@)) * s2;
            }
        }
    }
    if (jv == 0) break;
    float w = saturate(ws[k]);
    if (k == 0 && !tronco) wl = w;
    bool lin = jv < 0;
    [loop] for (int t = 0; t < 3; t++)
    {
        int j = (code & 31) - 1;
        code = code >> 5;
        if (j < 0) break;
        float4 ea = Tex.Load(int3(j, 0, 0));
        float3 tr = Tex.Load(int3(j, 2, 0)).xyz;
        if (ea.w == 0 && !any(tr)) continue;
        float3 pv = Tex.Load(int3(j, 1, 0)).xyz;
        float wq = w;
        if (fibra && lin)
        {
            float3 ri = tx.Gira(ip, pv, ea);
            if (w >= 0.0005)
            {
                wq = w * w;
                float3 tensa = g + w * (ri - ip);
                g = lerp(tensa, tx.Gira(g, pv, ea), wq);
            }
            ip = ri;
        }
        else if (w >= 0.0005)
        {
            float3 r = tx.Gira(g, pv, float4(ea.xyz, lin ? ea.w : ea.w * w));
            g = lin ? g + (r - g) * w : r;
        }
        if (w < 0.0005) continue;
        g += tr * w;
        float sh, ch; sincos(ea.w * wq * 0.5, sh, ch);
        float3 qv = ea.xyz * sh;
        qt = float4(ch * qt.xyz + qt.w * qv + cross(qv, qt.xyz), ch * qt.w - dot(qv, qt.xyz));
    }
}
Q = qt;
float3 o = (g - g0) * 100;
return float3(o.x, o.z, o.y);
"""
# La normal gira con la pieza: se pasa a local, se aplica el giro total del vértice (en glTF) y se devuelve a tangente
HLSL_GIRO = r"""
float l = length(Q);
float4 q = l > 1e-6 ? Q / l : float4(0, 0, 0, 1);
float3 g = float3(N.x, N.z, N.y);
float3 t = 2 * cross(q.xyz, g);
g = g + q.w * t + cross(q.xyz, t);
return float3(g.x, g.z, g.y);
"""


def _datos_mov():
    for f in (os.path.join(IMPORTAR, "datos", "movimiento.json"), os.path.join(DATOS, "movimiento.json")):
        if os.path.exists(f):
            with open(f, encoding="utf-8") as h:
                return json.load(h)
    raise RuntimeError("Falta movimiento.json: node tools/unreal/movimiento.js")


def _custom(g, codigo, entradas, tipo, extra=None, desc=""):
    cu = g.n(unreal.MaterialExpressionCustom, -500)
    cu.set_editor_property("description", desc)
    cu.set_editor_property("code", codigo)
    cu.set_editor_property("output_type", tipo)
    ins = []
    for nm in entradas:
        ci = unreal.CustomInput(); ci.set_editor_property("input_name", nm); ins.append(ci)
    cu.set_editor_property("inputs", ins)
    if extra:
        outs = []
        for nm, t in extra:
            co = unreal.CustomOutput(); co.set_editor_property("output_name", nm); co.set_editor_property("output_type", t); outs.append(co)
        cu.set_editor_property("additional_outputs", outs)
    return cu


def _transformar(g, e, origen, destino):
    t = g.n(unreal.MaterialExpressionTransform, -350)
    t.set_editor_property("transform_source_type", origen)
    t.set_editor_property("transform_type", destino)
    g.une(e, t, "")
    return t


def _postura(g):
    """World Position Offset del rig de la web; devuelve el giro total del vértice (cuaternión glTF) ya en el píxel."""
    CMOT = unreal.CustomMaterialOutputType
    tex = g.n(unreal.MaterialExpressionTextureObjectParameter, parameter_name="Postura")
    negro = unreal.load_asset("/Engine/EngineResources/Black")
    if negro:
        tex.set_editor_property("texture", negro)
    tex.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
    mov = _datos_mov()
    arts = [a["id"] for a in mov["articulaciones"]]
    with open(os.path.join(IMPORTAR, "datos", "rig.json"), encoding="utf-8") as h:
        sb = json.load(h)["scapBot_R"]          # ángulo inferior de la escápula derecha (la izquierda, en espejo)
    tor = mov["torax"]
    ancho_corr = 512        # ancho de la textura de correctivos (correctivos.json → ancho)
    for f in (os.path.join(IMPORTAR, "datos", "correctivos.json"), os.path.join(DATOS, "correctivos.json")):
        if os.path.exists(f):
            with open(f, encoding="utf-8") as h:
                ancho_corr = int(json.load(h).get("ancho", 512))
            break
    texc = g.n(unreal.MaterialExpressionTextureObjectParameter, parameter_name="Correctivo")
    if negro:
        texc.set_editor_property("texture", negro)
    texc.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
    codigo = HLSL_POSTURA
    for k, v in (("CW", ancho_corr), ("NA_TRONCO", len(arts) - 2), ("Y0", float(tor["y0"])), ("DY", float(tor["dy"])), ("ZC", float(tor["zc"])),
                 ("NH", int(tor["nh"])), ("NS", int(tor["ns"])), ("ACR_R", arts.index("acr_R")), ("ACR_L", arts.index("acr_L")),
                 ("SC_R", arts.index("sc_R")), ("SC_L", arts.index("sc_L")), ("SBX", sb[0]), ("SBY", sb[1]), ("SBZ", sb[2])):
        codigo = codigo.replace("@%s@" % k, repr(v))
    cu = _custom(g, codigo, ["Tex", "P", "U0", "U1", "U2", "U3"] + ["J%d" % i for i in range(8)] + ["HUG", "IX", "IY", "IZ"]
                 + ["TexC", "CB", "CNX", "CNY", "CNZ", "COX", "COY", "COZ", "CH"], CMOT.CMOT_FLOAT3,
                 extra=[("Q", CMOT.CMOT_FLOAT4)], desc="Postura (rig de la web)")
    g.une(tex, cu, "Tex")
    g.une(texc, cu, "TexC")
    # rejilla del correctivo elástico de la pieza: datos primitivos 24–31 (base, nodos por eje, esquina, celda)
    for i, nm in enumerate(("CB", "CNX", "CNY", "CNZ", "COX", "COY", "COZ", "CH")):
        g.une(g.esc("Rejilla" + nm, 0.0, cpd=24 + i), cu, nm)
    g.une(g.n(unreal.MaterialExpressionPreSkinnedPosition), cu, "P")
    for c in range(4):
        g.une(g.n(unreal.MaterialExpressionTextureCoordinate, coordinate_index=c), cu, "U%d" % c)
    for i in range(8):      # articulación de cada hueco: datos primitivos 12–19 (ACorpusCuerpo::CargarCapa)
        g.une(g.esc("Hueco%d" % i, 0.0, cpd=12 + i), cu, "J%d" % i)
    for i, nm in enumerate(("IX", "IY", "IZ")):      # punto de inserción (glTF, m) de las piezas de fibra tensa: datos primitivos 21–23
        g.une(g.esc("Insercion" + nm[1], 0.0, cpd=21 + i), cu, nm)
    g.une(g.esc("Abrazo", 0.0, cpd=20), cu, "HUG")      # 1 = dorsal ancho y redondo mayor: pegados a la parrilla costal
    S, D = unreal.MaterialVectorCoordTransformSource, unreal.MaterialVectorCoordTransform
    wpo = _transformar(g, cu, S.TRANSFORMSOURCE_LOCAL, D.TRANSFORM_WORLD)
    # «Empuje» (cm): separa la pieza de lo que tiene debajo a lo largo de su normal. Las áreas de origen e inserción están
    # dibujadas justo sobre el hueso y sin esto parpadean con él (tabla EMPUJE).
    wpo = g.add(wpo, g.mul(g.n(unreal.MaterialExpressionVertexNormalWS), g.esc("Empuje", 0.0)))
    g.sal(wpo, unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET)
    vi = g.n(unreal.MaterialExpressionVertexInterpolator, -300)
    g.une(cu, vi, "VS", "Q")
    return vi


def _girar_normal(g, normal_tangente, giro):
    S, D = unreal.MaterialVectorCoordTransformSource, unreal.MaterialVectorCoordTransform
    loc = _transformar(g, normal_tangente, S.TRANSFORMSOURCE_TANGENT, D.TRANSFORM_LOCAL)
    gi = _custom(g, HLSL_GIRO, ["N", "Q"], unreal.CustomMaterialOutputType.CMOT_FLOAT3, desc="Normal girada con la postura")
    g.une(loc, gi, "N"); g.une(giro, gi, "Q")
    return _transformar(g, gi, S.TRANSFORMSOURCE_LOCAL, D.TRANSFORM_TANGENT)


# ───────────────────────── plano de corte ─────────────────────────
# Colección de parámetros que leen los dos maestros: «Activo» (0/1) y «Plano» (normal en el mundo en xyz, posición a lo
# largo de la normal en w, en cm). Se dibuja lo que queda en dot(posición, normal) ≤ w. ACorpusCuerpo::PonerCorte la rellena.
R_MPC = R_MAT + "/MPC_Corte"
TAPA_CORTE = 1.0     # brillo de la tapa de la sección (emisivo × color del tejido); afinado en capturas
HLSL_CORTE = "return A < 0.5 ? 1.0 : (dot(WP, Pl.xyz) > Pl.w ? 0.0 : 1.0);"


def _coleccion_corte():
    """Crea (una sola vez: sus identificadores van grabados en los materiales) la colección MPC_Corte."""
    if eal.does_asset_exist(R_MPC):
        return eal.load_asset(R_MPC)
    mpc = herr.create_asset("MPC_Corte", R_MAT, unreal.MaterialParameterCollection, unreal.MaterialParameterCollectionFactoryNew())
    e = unreal.CollectionScalarParameter()
    e.set_editor_property("parameter_name", "Activo"); e.set_editor_property("default_value", 0.0)
    v = unreal.CollectionVectorParameter()
    v.set_editor_property("parameter_name", "Plano"); v.set_editor_property("default_value", unreal.LinearColor(1.0, 0.0, 0.0, 0.0))
    mpc.set_editor_property("scalar_parameters", [e])
    mpc.set_editor_property("vector_parameters", [v])
    eal.save_asset(R_MPC)
    return mpc


def _corte(g):
    """Devuelve (máscara 0/1 del plano de corte, «Activo»). La posición es la del mundo ya con la postura (World Position
    Offset incluido): el corte atraviesa el cuerpo tal como se ve, también en movimiento."""
    mpc = _coleccion_corte()
    act = g.n(unreal.MaterialExpressionCollectionParameter, collection=mpc, parameter_name="Activo")
    pl = g.n(unreal.MaterialExpressionCollectionParameter, collection=mpc, parameter_name="Plano")
    wp = g.n(unreal.MaterialExpressionWorldPosition)
    cu = _custom(g, HLSL_CORTE, ["A", "Pl", "WP"], unreal.CustomMaterialOutputType.CMOT_FLOAT1, desc="Plano de corte")
    g.une(act, cu, "A"); g.une(pl, cu, "Pl"); g.une(wp, cu, "WP")
    return cu, act


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
        # enmascarado: el plano de corte recorta con la máscara de opacidad (Nanite la admite; translúcido no)
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
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
    giro = _postura(g)
    pos = g.n(unreal.MaterialExpressionLocalPosition) if hasattr(unreal, "MaterialExpressionLocalPosition") else g.n(unreal.MaterialExpressionWorldPosition)
    try:   # posición de reposo: las estrías y el poro siguen pegados al tejido cuando la postura lo mueve
        pos.set_editor_property("included_offsets", unreal.PositionIncludedOffsets.EXCLUDE_OFFSETS)
    except Exception as e:  # noqa
        unreal.log_warning("Corpus: LocalPosition sin desplazamientos: %s" % e)
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
    # De lejos el grano mide menos de un píxel: cada píxel recibía una normal al azar y el brillo de todos ellos sumado
    # lavaba el músculo a rosa casi blanco (a cuerpo entero). Se apaga entre 0,25 y 0,5 ciclos por píxel, como las estrías,
    # y «lejos» (0 cerca, 1 a cuerpo entero) sube la rugosidad y baja la anisotropía para que no quede un velo brillante.
    pix = g.add(g.un(unreal.MaterialExpressionAbs, g.un(unreal.MaterialExpressionDDX, u)),
                g.un(unreal.MaterialExpressionAbs, g.un(unreal.MaterialExpressionDDY, u)))      # cm por píxel
    vg = g.un(unreal.MaterialExpressionSaturate, g.add(g.cte(2.0), g.mul(pix, g.cte(-24.0))))  # ruido a 6 ciclos/cm
    lejos = g.un(unreal.MaterialExpressionSaturate, g.mul(pix, g.cte(8.0)))
    grano = g.mul(g.mul(ruido, poro), vg)

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
    # el músculo salía rojo puro: se le quita parte de la saturación (parámetro por tejido, DESATURAR)
    des = g.n(unreal.MaterialExpressionDesaturation, -350)
    g.une(col, des, ""); g.une(g.esc("Desaturar", 0.0), des, "Fraction")
    col = g.mul(des, g.esc("Albedo", 1.0))                       # los tejidos casi blancos (hueso, cartílago) saturaban la imagen
    surco = g.add(g.cte(1.0), g.mul(g.mul(onda, fuerza), g.cte(0.10)))
    col = g.mul(col, surco)
    col = g.mul(col, g.add(g.cte(1.0), g.mul(grano, g.cte(0.25))))
    ao = g.lerp(g.cte(0.45), g.cte(1.0), mR)
    col = g.mul(col, ao)
    eRGB = g.n(unreal.MaterialExpressionComponentMask, -500, r=True, g=True, b=True, a=False); g.une(estado, eRGB, "")
    eA = g.n(unreal.MaterialExpressionComponentMask, -500, r=True, g=False, b=False, a=False); g.une(estado, eA, "", "A")
    col = g.lerp(col, eRGB, eA)
    brillo = g.mul(eRGB, g.mul(eA, g.cte(0.35)))                 # el estado brilla un poco: se lee en sombra
    corte, corte_on = _corte(g)
    if translucido:          # la capa translúcida recibe poca luz: un velo de su propio color la hace legible
        brillo = g.add(brillo, g.mul(col, g.cte(0.35)))
        g.sal(col, MP.MP_BASE_COLOR)
    else:
        # Tapa de la sección: con el corte activo, las caras de dentro (las que se ven a través del hueco) se pintan lisas,
        # con el color del tejido y sin luz, como la superficie de un corte macizo.
        cara = g.n(unreal.MaterialExpressionTwoSidedSign)
        dentro = g.mul(g.un(unreal.MaterialExpressionSaturate, g.mul(cara, g.cte(-1.0))), corte_on)
        g.sal(g.lerp(col, g.cte(0.0), dentro), MP.MP_BASE_COLOR)
        brillo = g.add(brillo, g.mul(g.mul(col, dentro), g.cte(TAPA_CORTE)))
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
        g.sal(_girar_normal(g, nn, giro), MP.MP_NORMAL)

    # Superficie húmeda: el tendón y el cartílago son más lisos; los surcos, algo más mates
    r = g.lerp(rug, g.cte(0.22), mG)
    r = g.lerp(r, g.cte(0.16), mB)
    r = g.add(r, g.mul(g.mul(onda, fuerza), g.cte(-0.05)))
    r = g.un(unreal.MaterialExpressionSaturate, g.add(r, g.mul(lejos, g.cte(0.30))))
    g.sal(r, MP.MP_ROUGHNESS)
    g.sal(esp, MP.MP_SPECULAR)
    if not translucido:
        g.sal(g.mul(g.mul(anis, noCart), g.lerp(g.cte(1.0), g.cte(0.25), lejos)), MP.MP_ANISOTROPY)
    g.sal(g.mul(mR, g.cte(1.0)), MP.MP_AMBIENT_OCCLUSION)

    opac = g.esc("Opacidad", 1.0, cpd=4)
    if translucido:
        g.sal(g.mul(opac, corte), MP.MP_OPACITY)
    else:
        g.sal(corte, MP.MP_OPACITY_MASK)
        # En el modelo Subsurface la opacidad es lo contrario de la dispersión: con opacidad 0,10 el hueso era casi cera
        # translúcida y la luz de frente lo dejaba como una silueta plana, sin relieve. Dispersión 0,10 → opacidad 0,90.
        inv = g.n(unreal.MaterialExpressionOneMinus, -300); g.une(sss, inv, "")
        g.sal(inv, MP.MP_OPACITY)
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
            mel.set_material_instance_scalar_parameter_value(mi, "Desaturar", float(DESATURAR.get(clave, 0.0)))
            mel.set_material_instance_scalar_parameter_value(mi, "Empuje", float(EMPUJE.get(clave, 0.0)))
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
        b.set_editor_property("use_full_precision_u_vs", True)   # pesos del movimiento en TEXCOORD_0…3 (índice + peso)
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
        final = "%s/%s" % (destino, nombre)
        if eal.does_asset_exist(final):
            eal.delete_asset(final)          # reimportación: la malla recién importada sustituye a la anterior
        if eal.rename_asset(ruta.split(".")[0], final):
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
