# Músculos agrupados separados uno a uno (tools/unreal/separar.js) + nombre propio en inglés (2026-11-22)
Set-Location $PSScriptRoot
"== COMPILAR =="
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" CorpusAtlasEditor Win64 Development "-Project=$PSScriptRoot\CorpusAtlas\CorpusAtlas.uproject" -WaitMutex 2>&1 | Select-String "error|Result:|warning C" | ForEach-Object { $_.Line }
"== REIMPORTAR =="
.\py.ps1 "ci.copiar_datos(); ci.importar_mallas(['hombre/muscular', 'mujer/muscular'])" -Limite 3000
"== CAPTURAS =="
.\captura.ps1 -Pasos "esperar 8; vista 2; sel n1630_5; encuadrar; foto sep_intercostal_es; idioma en; foto sep_intercostal_en; idioma es; sel n1765_1; encuadrar; foto sep_interoseo_mano; vista 4; sel n1897_2; encuadrar; foto sep_interoseo_pie; buscar intercostal externo; foto sep_buscador; vista 0; sel; foto sep_reposo"
