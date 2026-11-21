# Mosaico de antes y después a partir de capturas (sin instalar nada: System.Drawing de Windows).
#   .\mosaico.ps1 -Salida capturas\mosaico.png -Pares "Título|antes.png|después.png", ...
# Cada fila: título a la izquierda, «Antes» y «Después» recortados (se quitan los paneles de la interfaz).
param([string]$Salida, [string[]]$Pares, [int]$Ancho = 640, [int[]]$Recorte = @(330, 0, 1270, 670))
Add-Type -AssemblyName System.Drawing
$rw = $Recorte[2] - $Recorte[0]; $rh = $Recorte[3] - $Recorte[1]
$alto = [int]($Ancho * $rh / $rw); $margen = 14; $cab = 46; $tit = 34
$W = $margen * 3 + $Ancho * 2; $H = $cab + ($alto + $tit + $margen) * $Pares.Count + $margen
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(12, 16, 24))
$fT = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold)
$fF = New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold)
$fE = New-Object System.Drawing.Font "Segoe UI", 10
$bl = [System.Drawing.Brushes]::White; $gr = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 165, 185))
$rj = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 110, 90)); $vd = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(110, 210, 140))
$g.DrawString("Corpus Atlas · edición Unreal · movimiento del hombro y del tronco", $fT, $bl, $margen, 10)
$y = $cab
foreach ($p in $Pares) {
    $c = $p.Split("|")
    $g.DrawString($c[0], $fF, $bl, $margen, $y + 6)
    $g.DrawString("Antes", $fE, $rj, ($margen + $Ancho - 50), ($y + 10)); $g.DrawString("Después", $fE, $vd, ($margen * 2 + $Ancho * 2 - 64), ($y + 10))
    for ($k = 0; $k -lt 2; $k++) {
        $x = $margen + ($Ancho + $margen) * $k
        $f = $c[$k + 1]
        if ($f -and (Test-Path $f)) {
            $img = [System.Drawing.Image]::FromFile((Resolve-Path $f))
            $sx = $img.Width / 1600.0; $sy = $img.Height / 900.0
            $src = New-Object System.Drawing.RectangleF ($Recorte[0] * $sx), ($Recorte[1] * $sy), ($rw * $sx), ($rh * $sy)
            $dst = New-Object System.Drawing.RectangleF $x, ($y + $tit), $Ancho, $alto
            $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel); $img.Dispose()
        } else { $g.DrawString("(sin captura)", $fE, $gr, $x + 10, $y + $tit + 10) }
    }
    $y += $alto + $tit + $margen
}
$g.Dispose(); $bmp.Save((Join-Path (Get-Location) $Salida), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
"Mosaico: $Salida ($W × $H)"
