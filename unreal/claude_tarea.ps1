# Dorsal ancho en los ejercicios: correctivos elásticos del hombro también en el modo Ejercicio (2026-11-22)
Set-Location $PSScriptRoot
"== COMPILAR =="
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" CorpusAtlasEditor Win64 Development "-Project=$PSScriptRoot\CorpusAtlas\CorpusAtlas.uproject" -WaitMutex 2>&1 | Select-String "error|Result:|warning C" | ForEach-Object { $_.Line }
"== COPIAR DATOS =="
.\py.ps1 "ci.copiar_datos()" -Limite 900
"== CAPTURAS =="
.\captura.ps1 -Pasos "esperar 8; ejercicio latraise - 45; vista 1; foto dor_latraise_post; vista 0; foto dor_latraise_ant; ejercicio press - 45; vista 1; foto dor_press_post; vista 0; foto dor_press_ant; ejercicio frontraise - 45; vista 2; foto dor_frontraise_lado; ejercicio row - 45; vista 1; foto dor_row_post; ejercicio curl - 45; vista 1; foto dor_curl_post; ejercicio; rom hombro 2 R 150; vista 1; foto dor_rom_abd150"
