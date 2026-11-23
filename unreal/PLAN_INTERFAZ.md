# Plan de la interfaz (edición Unreal) — aprobado por el usuario el 2026-11-22

Origen: inventario del código (Explore), revisión de diseño (design-critique) y auditoría de accesibilidad (WCAG 2.1 AA adaptada
a escritorio), hechas sobre las capturas `unreal/capturas/ui_*.png` (1600×900). Interfaz Slate en
`Source/CorpusAtlas/CorpusInterfaz.cpp/.h`; no se migra a UMG/CommonUI. Cada fase: compilar, capturar antes/después
(1280×720, 1600×900 y 2560×1440), hoja de contactos y revisión antes de la siguiente.

## Sistema visual (base de todas las fases)
- Tipografía: Inter (licencia OFL) cargada como fuente propia; si falla, la fuente por defecto. Escala en pt de Slate:
  número del goniómetro 32 B · título de ficha 18 B · sección/pregunta 13 SemiBold · cuerpo 10,5 R · secundario 10 R gris ·
  etiqueta en mayúsculas 9 B gris con espaciado. Nada que haya que leer por debajo de 10 pt; notas clínicas 11 pt.
- Espaciado en múltiplos de 4 (4 · 8 · 12 · 16 · 24 · 32). Relleno de panel 20, margen a la pantalla 16, botón ≥ 32 de alto
  (≥ 36 de ancho), fila de lista 32–36. Radios: panel 16, tarjeta 10, botón 8, píldora 999.
- Color (todos como constantes; ningún FLinearColor suelto): tinta #E6EAF0 · gris frío #7F8C9E (etiquetas) ·
  acento azul clínico (una sola acción principal por panel; selección en grupo = borde y texto en acento, sin relleno) ·
  ámbar #F0A040 (medidas, clínica, avisos) · verde/rojo de examen solo como borde e icono.
- Movimiento: 100 ms al pasar el ratón, 150–200 ms entrar/cambiar, 220 ms plegar; EaseOut, desplazamientos ≤ 12 px.

## Fase 1 — legibilidad y sistema visual
1. Escala según la resolución desde el código (no tocar `DefaultEngine.ini`, que no se sube): envolver la interfaz en un
   `SDPIScaler` con curva por lado corto 720→0,9 · 1080→1,0 · 1440→1,25 · 2160→1,6, multiplicada por el ajuste
   «Tamaño del texto» (90/100/125/150 %, guardado en la configuración del usuario).
2. Texto oscuro sobre el acento (hoy blanco: 2,46:1; con texto oscuro ≈ 7,3:1).
3. Fichas de estilo únicas (paleta, `Letra()` con Inter, espaciados) y sustituir colores y rellenos sueltos.
4. Acento solo en la acción principal; la selección dentro de un grupo pasa a borde + texto.
5. Estilo propio para SCheckBox (borde gris 1,5 px, 18 px, fila entera clicable), SSlider (96 de ancho, barra visible,
   valor en el ToolTip, paso 0,05), SEditableTextBox del buscador (fondo PANEL2, ayuda en gris, lupa, 12–13 pt) y barras
   de desplazamiento (6 px, gris al 50 %).
6. Botones ≥ 32 px de alto e indicador de foco de teclado (borde 2 px claro); Ctrl+F al buscador; Esc cierra en orden
   resultados → ficha → Estudiar; las teclas F/H/I no actúan mientras se escribe.
7. Subtítulos azules de las filas → gris; tamaños mínimos (8–9 pt → 10–11 pt).

## Fase 2 — orden y espacio para el modelo
- Barra de modos Explorar · Movimiento · Estudiar con subrayado animado; el modo activo tiñe el borde del panel derecho.
- Barra flotante de disección abajo al centro (aislar, ocultar, fantasma, pelar −/+, corte S/C/A, restablecer) con ToolTips.
- Cruceta de vistas sobre el visor; idioma en un menú desplegable; panel izquierdo solo con cuerpo (control segmentado) y capas.
- Capas: icono de ojo, una línea con elipsis (nombre completo en ToolTip), opacidad con porcentaje, grupos plegables con «2/6»,
  degradado al pie de la lista.
- Plegado automático del panel izquierdo al abrir una ficha o Estudiar; el encuadre de la cámara compensa los paneles.
- El buscador no se solapa con la ficha ni con Estudiar en ventanas estrechas; las marcas usan la geometría real.

## Fase 3 — contenido y animación
- Ficha en bloques Anatomía (rejilla etiqueta/valor) · Función · Clínica (tarjeta con borde ámbar); enlaces a Estudiar agrupados
  por tipo con icono, 3 por tipo y «Ver los N».
- Examen: una pregunta cada vez, «Pregunta 2 de 5», barra de progreso, opciones A/B/C/D, ✓/✗ y colores con contraste ≥ 4,5:1.
- Animaciones: color al pasar el ratón, fundido cruzado al cambiar de ficha, la ficha y el estudio se van con fundido (no vaciarlos antes).
- Correcciones: el botón Movimiento refleja su estado; fila de lado del panel de movimiento sin desbordar; textos FR/DE sin
  salirse; literales al sistema de traducción; código duplicado (cabeceras de sección, botones de lista, marcha/ejercicio).
- Opción «Visión de color» (deuteranopía/protanopía/tritanopía) para la interfaz.

## Fuera de este plan
- Colores de las capas en el modelo 3D (materiales; pasa por director-clinico).
