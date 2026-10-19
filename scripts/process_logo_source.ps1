# scripts/process_logo_source.ps1
Add-Type -AssemblyName System.Drawing

$srcPath = "public/logo-source.jpg"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $srcPath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)
Write-Output "Source loaded: $($srcImg.Width) x $($srcImg.Height)"

function Generate-CircleCroppedIcon([int]$size, [string]$destPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Découpage en cercle parfait
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $margin = 2.0 * ($size / 512.0)
    $diameter = $size - (2 * $margin)
    $path.AddEllipse([float]$margin, [float]$margin, [float]$diameter, [float]$diameter)
    $g.SetClip($path)

    # Calcul du cadrage pour remplir le cercle (Center crop / cover)
    $srcW = $srcImg.Width
    $srcH = $srcImg.Height
    $minDim = [Math]::Min($srcW, $srcH)
    $srcX = ($srcW - $minDim) / 2.0
    $srcY = ($srcH - $minDim) / 2.0

    $destRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $srcRect = New-Object System.Drawing.RectangleF([float]$srcX, [float]$srcY, [float]$minDim, [float]$minDim)

    $g.DrawImage($srcImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $g.ResetClip()
    $path.Dispose()

    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Saved: $destPath ($size x $size)"
}

Generate-CircleCroppedIcon 512 "public/icon-512.png"
Generate-CircleCroppedIcon 192 "public/icon-192.png"
Generate-CircleCroppedIcon 180 "public/apple-touch-icon.png"
Generate-CircleCroppedIcon 64 "public/favicon.png"

$srcImg.Dispose()
Write-Output "All circle cropped icons generated successfully!"
