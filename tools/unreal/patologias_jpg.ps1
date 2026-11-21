# Corpus Atlas (edición Unreal) — pasa a JPG (fondo blanco) las ilustraciones PNG de unreal/patologias/img que pesan
# más de 250 kB y corrige el nombre en atribuciones.json. Se ejecuta después de tools/unreal/patologias_img.js.
Add-Type -AssemblyName System.Drawing
$raiz = Join-Path $PSScriptRoot "..\..\unreal\patologias"
$img = Join-Path $raiz "img"
$fAtr = Join-Path $raiz "atribuciones.json"
$json = [IO.File]::ReadAllText($fAtr, [Text.Encoding]::UTF8)
$codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$par = New-Object Drawing.Imaging.EncoderParameters 1
$par.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality, [long]88)
foreach ($f in Get-ChildItem $img -Filter *.png) {
  if ($f.Length -lt 250kb) { continue }
  $src = [Drawing.Image]::FromFile($f.FullName)
  $bmp = New-Object Drawing.Bitmap $src.Width, $src.Height, ([Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::White); $g.DrawImage($src, 0, 0, $src.Width, $src.Height); $g.Dispose(); $src.Dispose()
  $jpg = [IO.Path]::ChangeExtension($f.FullName, ".jpg")
  $bmp.Save($jpg, $codec, $par); $bmp.Dispose()
  Remove-Item -LiteralPath $f.FullName -Confirm:$false
  $json = $json.Replace('"' + $f.Name + '"', '"' + [IO.Path]::GetFileName($jpg) + '"')
  "{0}: {1:N0} kB -> {2:N0} kB" -f $f.Name, ($f.Length / 1kb), ((Get-Item $jpg).Length / 1kb)
}
[IO.File]::WriteAllText($fAtr, $json, (New-Object Text.UTF8Encoding $false))
