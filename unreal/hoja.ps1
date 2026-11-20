# Hoja de contactos: junta varias imágenes en una rejilla con su nombre debajo (para revisar muchas posturas de un vistazo).
#   .\hoja.ps1 -Salida hoja.png -Imagenes a.png,b.png,... [-Columnas 4] [-Lado 420] [-Recorte x0,y0,x1,y1 en fracciones 0–1]
param([string]$Salida, [string[]]$Imagenes, [string[]]$Rotulos = @(), [int]$Columnas = 4, [int]$Lado = 420, [double[]]$Recorte = @(0.15, 0.1, 0.85, 0.8))
Add-Type -AssemblyName System.Drawing
$n = $Imagenes.Count; $filas = [Math]::Ceiling($n / $Columnas); $pie = 24
$bmp = New-Object System.Drawing.Bitmap ($Columnas * $Lado), ($filas * ($Lado + $pie))
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Black); $f = New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)
for ($i = 0; $i -lt $n; $i++) {
    $x = ($i % $Columnas) * $Lado; $y = [Math]::Floor($i / $Columnas) * ($Lado + $pie)
    if (Test-Path $Imagenes[$i]) {
        $img = [System.Drawing.Image]::FromFile((Resolve-Path $Imagenes[$i]))
        $src = New-Object System.Drawing.RectangleF ($img.Width * $Recorte[0]), ($img.Height * $Recorte[1]), ($img.Width * ($Recorte[2] - $Recorte[0])), ($img.Height * ($Recorte[3] - $Recorte[1]))
        $g.DrawImage($img, (New-Object System.Drawing.RectangleF $x, $y, $Lado, $Lado), $src, [System.Drawing.GraphicsUnit]::Pixel); $img.Dispose()
    }
    $t = if ($i -lt $Rotulos.Count) { $Rotulos[$i] } else { [IO.Path]::GetFileNameWithoutExtension($Imagenes[$i]) }
    $g.DrawString($t, $f, [System.Drawing.Brushes]::White, $x + 6, $y + $Lado + 2)
}
$g.Dispose(); $bmp.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); "Hoja: $Salida"
