# Verificación visual de la edición Unreal (equivalente a ?qa en la web).
#   .\captura.ps1 -Pasos "foto inicio; sel n1394; foto ficha; buscar biceps; foto buscador"
#   .\captura.ps1 -Exposicion 4.0 -Pasos "foto expo4"
# Opcionalmente ajusta la exposición del mapa; luego lanza el juego con -QaPasos (ACorpusJugador::TickQa espera a que
# terminen los shaders, ejecuta cada paso y se cierra) y copia las fotos de Saved/Capturas a unreal/capturas/.
# Pasos: foto <nombre> · sel <id> · encuadrar · aislar [id] · ocultar [id] · todo · vista <0-5> · capa <clave> <0|1>
#        cuerpo <hombre|mujer|vh> · buscar <texto> · esperar <s> · cualquier otro texto = comando de consola
param([double]$Exposicion = [double]::NaN, [string]$Pasos = "foto captura", [int]$Limite = 300)
$raiz = Join-Path $PSScriptRoot "CorpusAtlas"
$proy = Join-Path $raiz "CorpusAtlas.uproject"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
if (-not [double]::IsNaN($Exposicion)) {
    $py = Join-Path $raiz "Saved\corpus_expo.py"
    @"
import traceback, unreal
try:
    import importlib, corpus_importar as ci
    importlib.reload(ci)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(ci.R_MAPA)
    ci.ajustar_exposicion($Exposicion)
    unreal.log("CORPUS_RUN_OK")
except Exception:
    unreal.log_error("CORPUS_RUN_FALLO\n" + traceback.format_exc())
unreal.SystemLibrary.quit_editor()
"@ | Set-Content -Path $py -Encoding utf8
    $pr = Start-Process -FilePath $ue -ArgumentList "`"$proy`"", "-ExecutePythonScript=`"$($py -replace '\\','/')`"", "-nosplash", "-unattended", "-log=CorpusExpo.log" -PassThru
    $pr.WaitForExit()
}
$dir = Join-Path $raiz "Saved\Capturas"
Remove-Item "$dir\*.png" -ErrorAction SilentlyContinue
$pr = Start-Process -FilePath $ue -ArgumentList "`"$proy`"", "-game", "-windowed", "-ResX=1600", "-ResY=900", "-log=CorpusJuego.log", "-QaPasos=`"$Pasos`"" -PassThru
if (-not $pr.WaitForExit($Limite * 1000)) { $pr | Stop-Process -Force; "AVISO: el juego no terminó en $Limite s" }
$sal = Join-Path $PSScriptRoot "capturas"
New-Item -ItemType Directory -Force $sal | Out-Null
Get-ChildItem "$dir\*.png" -ErrorAction SilentlyContinue | ForEach-Object { Copy-Item $_.FullName (Join-Path $sal $_.Name) -Force; Join-Path $sal $_.Name }
Get-Content (Join-Path $raiz "Saved\Logs\CorpusJuego.log") | Select-String "CorpusQa|Failed to compile" | ForEach-Object { $_.Line }
