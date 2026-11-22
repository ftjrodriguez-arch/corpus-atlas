# Sprint 2: ejercicios con postura (fuente «ct» de movimiento.js) (2026-11-22)
Set-Location (Split-Path $PSScriptRoot -Parent)
"node: " + (Get-Command node -ErrorAction SilentlyContinue).Source
$pw = Join-Path $env:LOCALAPPDATA "corpus-playwright"
if (-not (Test-Path "$pw\node_modules\playwright")) {
  "== INSTALAR PLAYWRIGHT (solo la primera vez) =="
  New-Item -ItemType Directory -Force $pw | Out-Null
  Push-Location $pw; npm init -y 2>&1 | Out-Null; npm i playwright@1 2>&1 | Select-Object -Last 3; npx playwright install chromium 2>&1 | Select-Object -Last 2; Pop-Location
}
$env:NODE_PATH = "$pw\node_modules"
"NODE_PATH: $env:NODE_PATH"
$srv = Start-Process -FilePath "py" -ArgumentList "-m", "http.server", "8765" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3
"== HORNEAR =="
node tools/unreal/movimiento.js --solo-ejercicios 2>&1 | ForEach-Object { "$_" }
$srv | Stop-Process -Force -ErrorAction SilentlyContinue
Set-Location $PSScriptRoot
if (Select-String -Path "$PSScriptRoot\claude_tarea_log.txt" -Pattern "Ejercicios: datos/movimiento.json" -Quiet) {
  "== COPIAR Y CAPTURAS =="
  .\py.ps1 "ci.copiar_datos()" -Limite 600
  .\captura.ps1 -Pasos "esperar 8; ejercicio lunge - 45; vista 2; foto ej_lunge; ejercicio deadlift - 45; foto ej_deadlift; ejercicio sitstand - 45; foto ej_sitstand; ejercicio curl - 45; foto ej_curl; ejercicio latraise - 45; vista 0; foto ej_latraise; ejercicio press - 45; foto ej_press; ejercicio row - 45; vista 2; foto ej_row; ejercicio hipabd - 45; vista 0; foto ej_hipabd; ejercicio frontraise - 45; vista 2; foto ej_frontraise; ejercicio kickback - 45; foto ej_kickback; ejercicio"
}
