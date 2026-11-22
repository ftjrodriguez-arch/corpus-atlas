# Rotatores separados por vértebra (tools/unreal/separar.js) (2026-11-22)
Set-Location $PSScriptRoot
"== REIMPORTAR =="
.\py.ps1 "ci.copiar_datos(); ci.importar_mallas(['hombre/muscular', 'mujer/muscular'])" -Limite 3000
"== CAPTURAS =="
.\captura.ps1 -Pasos "esperar 8; vista 1; sel n1590_14; encuadrar; aislar; foto sep_rotadores_T7; todo; buscar rotadores; foto sep_rotadores_buscador; sel; vista 0; foto sep2_reposo; cuerpo mujer; vista 2; sel n1630_5; encuadrar; foto sep_mujer_intercostal"
