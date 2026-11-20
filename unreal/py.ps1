# Ejecuta Python de corpus_importar en el editor de Unreal sin ventana de trabajo y lo cierra al acabar.
#   .\unreal\py.ps1 "ci.copiar_datos(); ci.crear_materiales()"
# El editor a veces se queda colgado al cerrarse tras -ExecutePythonScript: se espera a CORPUS_RUN_OK / CORPUS_RUN_FALLO
# en el registro y se cierra el proceso.
param([string]$Py, [int]$Limite = 3600, [string]$Registro = "CorpusPy.log")
$raiz = Join-Path $PSScriptRoot "CorpusAtlas"
$proy = Join-Path $raiz "CorpusAtlas.uproject"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$guion = Join-Path $raiz "Saved\corpus_py.py"
@"
import traceback, importlib, unreal
try:
    import corpus_importar as ci
    importlib.reload(ci)
    $Py
    unreal.log('CORPUS_RUN_OK')
except Exception:
    unreal.log_error('CORPUS_RUN_FALLO\n' + traceback.format_exc())
unreal.SystemLibrary.quit_editor()
"@ | Set-Content -Path $guion -Encoding utf8
$log = Join-Path $raiz "Saved\Logs\$Registro"
Remove-Item $log -ErrorAction SilentlyContinue
$pr = Start-Process -FilePath $ue -ArgumentList "`"$proy`"", "-ExecutePythonScript=`"$($guion -replace '\\','/')`"", "-nosplash", "-unattended", "-log=$Registro" -PassThru
$t0 = Get-Date; $fin = $null
while (-not $pr.HasExited -and ((Get-Date) - $t0).TotalSeconds -lt $Limite) {
    Start-Sleep -Seconds 5
    if (Test-Path $log) { $fin = Select-String -Path $log -Pattern "CORPUS_RUN_(OK|FALLO)" -ErrorAction SilentlyContinue | Select-Object -Last 1; if ($fin) { break } }
}
if (-not $pr.HasExited) { if (-not $pr.WaitForExit(30000)) { $pr | Stop-Process -Force } }
if ($fin) { $fin.Line } else { "AVISO: no apareció CORPUS_RUN en $Limite s" }
if (Test-Path $log) { Select-String -Path $log -Pattern "CORPUS_RUN_FALLO" -Context 0, 25 | ForEach-Object { $_.Context.PostContext } ; Select-String -Path $log -Pattern "Corpus: |Failed to compile|error X\d+" | Select-Object -Last 12 | ForEach-Object { $_.Line } }
"Tiempo: {0:N0} s" -f ((Get-Date) - $t0).TotalSeconds
