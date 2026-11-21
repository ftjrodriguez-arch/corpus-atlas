# Hojas de contactos del hombro en Blender (1 s por postura): todas las posturas de la lista, por delante y por detrás.
#   .\unreal\hojas_hombro.ps1 [-Corr] [-Prefijo c] [-Solo "elev40,ext60"] [-Lado R]
# -Corr usa los correctivos elásticos (tools/unreal/correctivos.js); sin él, lo que hace hoy el material.
param([switch]$Corr, [string]$Prefijo = "h", [string]$Solo = "", [string]$Lado = "R", [string]$Ids = "")
$raiz = Split-Path $PSScriptRoot -Parent
$sim = Join-Path $raiz "unreal\CorpusAtlas\Saved\sim"
$blender = "X:\software\Blender 5.2\blender.exe"
if (-not $Ids) { $Ids = "n1610,n1687,n1681,n1682,n1597,n1598,n1599,n1673,n1674,n1675,n1608,n1609,n1632,n1619,n1620,n1621,n1699,n1689,n1690,n1694,n1679,n1680,n1607,n1629,n1634,n1697,n1698" }
if ($Lado -eq "L") { throw "de momento solo el lado derecho (los ids de la lista son del derecho)" }
$posturas = @(
    @("flex90", "hombro", 0, 90), @("flex150", "hombro", 0, 150), @("ext60", "hombro", 1, 60), @("abd90", "hombro", 2, 90), @("abd150", "hombro", 2, 150), @("adu30", "hombro", 3, 30),
    @("rotint70", "hombro", 4, 70), @("rotext90", "hombro", 5, 90), @("abdhor45", "hombro", 6, 45), @("aduhor120", "hombro", 7, 120),
    @("elev40", "escapula", 0, 40), @("depr10", "escapula", 1, 10), @("protr15", "escapula", 2, 15), @("retr15", "escapula", 3, 15))
if ($Solo) { $q = $Solo.Split(","); $posturas = $posturas | Where-Object { $q -contains $_[0] } }
if ($Corr) { $env:CORR = "1" } else { Remove-Item Env:CORR -ErrorAction SilentlyContinue }
$nombres = @()
foreach ($p in $posturas) {
    $dir = Join-Path $sim ("grupo_{0}{1}{2}" -f $p[1], $p[2], $Lado)
    node (Join-Path $raiz "tools\unreal\blender\posar.js") $Ids $p[1] $p[2] $Lado $p[3] $p[3] | Out-Null
    & $blender -b --python (Join-Path $raiz "tools\unreal\blender\simular_musculo.py") -- $dir sinsim | Out-Null
    foreach ($v in "ant", "post", "lat") { Copy-Item (Join-Path $dir "material_$v.png") (Join-Path $sim ("{0}_{1}_{2}.png" -f $Prefijo, $p[0], $v)) -Force }
    $nombres += $p[0]
}
Remove-Item Env:CORR -ErrorAction SilentlyContinue
foreach ($v in "ant", "post") {
    & (Join-Path $PSScriptRoot "hoja.ps1") -Salida (Join-Path $sim ("hoja_{0}_{1}.png" -f $Prefijo, $v)) -Imagenes ($nombres | ForEach-Object { Join-Path $sim ("{0}_{1}_{2}.png" -f $Prefijo, $_, $v) }) -Rotulos $nombres -Columnas 5 -Lado 380
}
