# Corpus Atlas - servidor local minimo para usar la app sin internet (Windows, sin instalar nada).
# Sirve solo la carpeta de Corpus y solo para este ordenador (localhost).
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.txt'='text/plain; charset=utf-8'; '.md'='text/plain; charset=utf-8'; '.wasm'='application/wasm';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.woff2'='font/woff2';
  '.webmanifest'='application/manifest+json' }
$listener = $null; $port = 0
foreach ($p in 8765..8785) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $listener = $l; $port = $p; break } catch { }
}
if (-not $listener) { Write-Host 'No se pudo abrir un puerto local (8765-8785).'; Read-Host 'Pulsa Enter para salir'; exit 1 }
$url = "http://localhost:$port/index.html"
Write-Host ''
Write-Host "  Corpus Atlas esta funcionando en $url"
Write-Host '  Deja esta ventana abierta mientras lo uses. Para cerrar Corpus, cierra esta ventana.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext(); $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    if ($file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      if ($types.ContainsKey($ext)) { $res.ContentType = $types[$ext] } else { $res.ContentType = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else { $res.StatusCode = 404 }
    $res.OutputStream.Close()
  } catch { }
}
