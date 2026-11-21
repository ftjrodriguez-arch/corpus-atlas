---
name: ue5-visual-qa
description: Usar en Corpus Atlas (edición Unreal) para importar y validar mallas anatómicas, compilar, y capturar y revisar vistas y tiras de movimiento antes de cerrar cualquier tarea.
---

# Corpus Atlas · importación y verificación visual en Unreal

Todo se ejecuta desde `X:\corpus atlas` en PowerShell. Unreal 5.8 en `C:\Program Files\Epic Games\UE_5.8`.
Nada se da por terminado sin capturas revisadas.

## Compilar
```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" CorpusAtlasEditor Win64 Development -Project="X:\corpus atlas\unreal\CorpusAtlas\CorpusAtlas.uproject" -WaitMutex -NoHotReloadFromIDE
```

## Importar y validar mallas
- Exportar desde la web: `node tools/unreal/exportar.js` (GLB sin comprimir, en metros, Y arriba; Unreal convierte a
  centímetros y Z arriba). Después `node tools/unreal/movimiento.js` (pesos en TEXCOORD) y
  `node --max-old-space-size=12000 tools/unreal/tendones.js <hombre|mujer> --aplicar`.
- Python de Unreal sin abrir el editor a mano: `.\unreal\py.ps1 "<código con ci.>"`. Ejemplos:
  `ci.crear_materiales()` (20 s) · `ci.importar_mallas(["hombre/muscular", "mujer/muscular"])` (unos 12 min) ·
  `ci.todo()` (importación completa, 1 h 45 min).
- El editor se queda colgado al salir tras un guion: `py.ps1` espera `CORPUS_RUN_OK` en el registro y lo cierra.
- Qué comprobar tras importar: número de piezas por capa igual al del manifiesto; Nanite activo; el color por vértice
  llega (los tendones se ven blancos); escala real (el cuerpo mide unos 175 cm); ninguna pieza gris (material sin compilar:
  mirar `Saved/Logs/CorpusJuego.log`).
- Blender (`X:\software\Blender 5.2`, modo `-b`) se usa para modelar piezas nuevas y como visor de posturas
  (`tools/unreal/blender/posar.js`). Las piezas nuevas entran por `data/nuevos.json`, no como archivos sueltos.

## Capturar
```powershell
.\unreal\captura.ps1 -Pasos "esperar 4; foto frente; vista 2; foto lado; enfocar n154,n269; foto detalle"
```
Pasos: `foto <nombre>` · `esperar <s>` · `vista <0-5>` (anterior, posterior, derecha, izquierda, superior, inferior) ·
`sel <id>` · `encuadrar` · `enfocar <ids>` · `acercar <factor>` · `aislar` · `ocultar` · `todo` · `solo <ids>` ·
`capa <clave> <0|1>` · `opacidad <clave> <valor>` · `cuerpo <hombre|mujer|vh>` · `idioma <código>` · `buscar <texto>` ·
`rom <id> <movimiento> <R|L> <grados>` · `marcha <patrón> <%>` ·
`estudio <módulo> [grupo] [entrada] [paso]` · cualquier otro texto = comando de consola.
Las fotos quedan en `unreal/capturas/`. Juntarlas siempre en una hoja:
```powershell
.\unreal\hoja.ps1 -Salida unreal\capturas\hoja.png -Imagenes (Get-ChildItem unreal\capturas -Filter "x_*.png").FullName -Columnas 4 -Lado 620 -Recorte 0.2,0,0.8,1
```
`unreal/mosaico.ps1` compara antes y después.

### Juego mínimo de capturas por tipo de tarea
- **Capa o material:** frente, espalda, lado, detalle cercano y cuerpo entero de lejos (el velo blanco solo aparece lejos).
- **Movimiento:** tira de 5 fotogramas (0, 25, 50, 75 y 100 % del rango) de frente y de lado, con y sin músculos.
- **Marcha o taller:** de 4 a 6 instantes del ciclo.
- **Interfaz:** panel abierto, panel cerrado (el modelo vuelve a su estado) y un segundo idioma.

## Lista de comprobación antes de cerrar
- [ ] Ningún músculo atraviesa hueso ni se separa del cuerpo; sin roturas ni «velas» en la malla.
- [ ] Hueso, cartílago, tendón, ligamento, fascia y músculo se distinguen a simple vista.
- [ ] Todo músculo visible llega a su inserción en tendón; los orígenes carnosos anchos no salen blancos.
- [ ] Hueso con relieve de frente (no silueta plana) y músculo sin lavar a rosa o blanco de lejos.
- [ ] Luz limpia: sin zonas quemadas ni negras; el fondo no distrae.
- [ ] Cámara: órbita, zoom, encuadre con doble clic y las seis vistas funcionan.
- [ ] Interfaz sin solapamientos y el modelo ocupa la mayor parte de la pantalla.
- [ ] Al cerrar un panel vuelven capas, opacidades, cuerpo y cámara.
- [ ] Probado en un segundo idioma.

## Rendimiento e interfaz (tomado de los skills del usuario)
- Tras un cambio visual importante, medir con los pasos de consola `stat unit` y `stat gpu` en la misma escena
  antes y después, y anotar los milisegundos en `unreal/LEEME.md`.
- Probar la interfaz al menos en 1280×720 y 1920×1080 (`captura.ps1` acepta `r.SetRes 1280x720w` como paso de consola).
- Al corregir algo visual, la captura de antes y la de después van lado a lado (`unreal/mosaico.ps1`).

## Trampas conocidas
- El usuario prueba la aplicación en la misma ventana que abre `captura.ps1`: si la mueve, las fotos salen alteradas
  (otro encuadre, capas apagadas, una ficha abierta). Repetir antes de dar un resultado por malo.
- Sin cocinar, los shaders se compilan al arrancar y todo sale gris unos segundos: `TickQa` espera, pero conviene
  `esperar 4` al principio.
- PowerShell 5.1: escribir los archivos en UTF-8 sin BOM (`[IO.File]::WriteAllText` con `UTF8Encoding $false`);
  `mosaico.ps1` sí necesita BOM.
- Si cambia el HLSL de postura en `corpus_importar.py`, cambiar también `tools/unreal/postura.js` y `simular.js`.
- `git push` puede mostrar error en PowerShell aunque haya subido: comprobar con `git status -sb`.
