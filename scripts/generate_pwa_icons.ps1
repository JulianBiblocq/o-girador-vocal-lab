# scripts/generate_pwa_icons.ps1
Add-Type -AssemblyName System.Drawing

function Generate-CordelIcon([int]$targetSize, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = $targetSize / 512.0

    # Couleurs Cordel unifiées
    $parchment = [System.Drawing.ColorTranslator]::FromHtml("#f4ecd8")
    $terracotta = [System.Drawing.ColorTranslator]::FromHtml("#9a3412")
    $ciano = [System.Drawing.ColorTranslator]::FromHtml("#0f766e")
    $ocre = [System.Drawing.ColorTranslator]::FromHtml("#c88a2b")
    $ink = [System.Drawing.ColorTranslator]::FromHtml("#1a1a1a")

    $brushParchment = New-Object System.Drawing.SolidBrush($parchment)
    $brushTerracotta = New-Object System.Drawing.SolidBrush($terracotta)
    $brushCiano = New-Object System.Drawing.SolidBrush($ciano)
    $brushOcre = New-Object System.Drawing.SolidBrush($ocre)
    $brushInk = New-Object System.Drawing.SolidBrush($ink)

    # 1. Médaillon fond parchemin
    $margin = 16.0 * $s
    $medallionSize = $targetSize - (2 * $margin)
    $g.FillEllipse($brushParchment, [float]$margin, [float]$margin, [float]$medallionSize, [float]$medallionSize)

    # 2. Anneau Rouge Terracotta #9a3412
    $penTerracotta = New-Object System.Drawing.Pen($terracotta, [float](16.0 * $s))
    $g.DrawEllipse($penTerracotta, [float]$margin, [float]$margin, [float]$medallionSize, [float]$medallionSize)

    # 3. Filet d'encre intérieur #1a1a1a
    $innerMargin = 26.0 * $s
    $innerSize = $targetSize - (2 * $innerMargin)
    $penInk = New-Object System.Drawing.Pen($ink, [float](4.0 * $s))
    $g.DrawEllipse($penInk, [float]$innerMargin, [float]$innerMargin, [float]$innerSize, [float]$innerSize)

    # 4. Tourbillon de Rubans (Terracotta, Ciano, Ocre, Encre)
    $cx = [float]($targetSize / 2.0)
    $cy = [float]($targetSize / 2.0)

    $colors = @($brushTerracotta, $brushCiano, $brushOcre, $brushInk)
    for ($i = 0; $i -lt 4; $i++) {
        $angle = $i * 90.0
        $state = $g.Save()
        $g.TranslateTransform($cx, $cy)
        $g.RotateTransform($angle)

        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        # Coordonnées relatives normalisées (base 512, centré en 0,0)
        $p1 = New-Object System.Drawing.PointF([float](0 * $s), [float](-210 * $s))
        $p2 = New-Object System.Drawing.PointF([float](120 * $s), [float](-180 * $s))
        $p3 = New-Object System.Drawing.PointF([float](190 * $s), [float](-80 * $s))
        $p4 = New-Object System.Drawing.PointF([float](160 * $s), [float](20 * $s))
        $p5 = New-Object System.Drawing.PointF([float](110 * $s), [float](60 * $s))
        $p6 = New-Object System.Drawing.PointF([float](60 * $s), [float](40 * $s))
        $p7 = New-Object System.Drawing.PointF([float](90 * $s), [float](10 * $s))
        $p8 = New-Object System.Drawing.PointF([float](130 * $s), [float](-60 * $s))
        $p9 = New-Object System.Drawing.PointF([float](80 * $s), [float](-140 * $s))
        $p10 = New-Object System.Drawing.PointF([float](-10 * $s), [float](-160 * $s))

        $points = @($p1, $p2, $p3, $p4, $p5, $p6, $p7, $p8, $p9, $p10)
        $path.AddClosedCurve($points, 0.45)

        $g.FillPath($colors[$i], $path)
        $g.Restore($state)
        $path.Dispose()
    }

    # 5. Ondes acoustiques émanantes
    $penWave1 = New-Object System.Drawing.Pen($terracotta, [float](3.0 * $s))
    $penWave1.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawEllipse($penWave1, [float]($cx - 105 * $s), [float]($cy - 105 * $s), [float](210 * $s), [float](210 * $s))

    $penWave2 = New-Object System.Drawing.Pen($ciano, [float](2.5 * $s))
    $penWave2.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawEllipse($penWave2, [float]($cx - 120 * $s), [float]($cy - 120 * $s), [float](240 * $s), [float](240 * $s))

    # 6. Médaillon central pour le micro
    $centerRadius = 80.0 * $s
    $g.FillEllipse($brushParchment, [float]($cx - $centerRadius), [float]($cy - $centerRadius), [float]($centerRadius * 2), [float]($centerRadius * 2))
    $penCenterInk = New-Object System.Drawing.Pen($ink, [float](6.0 * $s))
    $g.DrawEllipse($penCenterInk, [float]($cx - $centerRadius), [float]($cy - $centerRadius), [float]($centerRadius * 2), [float]($centerRadius * 2))

    # 7. Microphone vintage central studio (Gravure Cordel)
    # Étrier pivotant
    $penEtrier = New-Object System.Drawing.Pen($ink, [float](6.5 * $s))
    $penEtrier.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penEtrier.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($penEtrier, [float]($cx - 36 * $s), [float]($cy - 20 * $s), [float](72 * $s), [float](74 * $s), 10, 160)

    # Vis molettes étrier
    $g.FillEllipse($brushTerracotta, [float]($cx - 40 * $s), [float]($cy - 18 * $s), [float](10 * $s), [float](10 * $s))
    $g.DrawEllipse($penInk, [float]($cx - 40 * $s), [float]($cy - 18 * $s), [float](10 * $s), [float](10 * $s))
    $g.FillEllipse($brushTerracotta, [float]($cx + 30 * $s), [float]($cy - 18 * $s), [float](10 * $s), [float](10 * $s))
    $g.DrawEllipse($penInk, [float]($cx + 30 * $s), [float]($cy - 18 * $s), [float](10 * $s), [float](10 * $s))

    # Tige et Socle
    $g.FillRectangle($brushInk, [float]($cx - 4 * $s), [float]($cy + 46 * $s), [float](8 * $s), [float](22 * $s))
    $g.FillEllipse($brushInk, [float]($cx - 34 * $s), [float]($cy + 62 * $s), [float](68 * $s), [float](18 * $s))
    $g.FillEllipse($brushOcre, [float]($cx - 26 * $s), [float]($cy + 63 * $s), [float](52 * $s), [float](12 * $s))

    # Capsule studio capsule rect + arrondis
    $capPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $capRect = New-Object System.Drawing.RectangleF([float]($cx - 20 * $s), [float]($cy - 64 * $s), [float](40 * $s), [float](68 * $s))
    $capRadius = 18.0 * $s
    $capPath.AddArc([float]($capRect.X), [float]($capRect.Y), [float]($capRadius * 2), [float]($capRadius * 2), 180, 90)
    $capPath.AddArc([float]($capRect.Right - $capRadius * 2), [float]($capRect.Y), [float]($capRadius * 2), [float]($capRadius * 2), 270, 90)
    $capPath.AddArc([float]($capRect.Right - $capRadius * 2), [float]($capRect.Bottom - $capRadius * 2), [float]($capRadius * 2), [float]($capRadius * 2), 0, 90)
    $capPath.AddArc([float]($capRect.X), [float]($capRect.Bottom - $capRadius * 2), [float]($capRadius * 2), [float]($capRadius * 2), 90, 90)
    $capPath.CloseFigure()
    $g.FillPath($brushInk, $capPath)

    # Bague centrale cuivrée
    $g.FillRectangle($brushOcre, [float]($cx - 22 * $s), [float]($cy - 30 * $s), [float](44 * $s), [float](6 * $s))

    # Grille horizontale parchemin
    $penGrille = New-Object System.Drawing.Pen($parchment, [float](2.5 * $s))
    $penGrille.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penGrille.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($penGrille, [float]($cx - 12 * $s), [float]($cy - 52 * $s), [float]($cx + 12 * $s), [float]($cy - 52 * $s))
    $g.DrawLine($penGrille, [float]($cx - 15 * $s), [float]($cy - 45 * $s), [float]($cx + 15 * $s), [float]($cy - 45 * $s))
    $g.DrawLine($penGrille, [float]($cx - 16 * $s), [float]($cy - 38 * $s), [float]($cx + 16 * $s), [float]($cy - 38 * $s))

    # Bas de corps terracotta et voyant ciano
    $g.FillRectangle($brushTerracotta, [float]($cx - 14 * $s), [float]($cy - 18 * $s), [float](28 * $s), [float](14 * $s))
    $g.FillEllipse($brushCiano, [float]($cx - 3.5 * $s), [float]($cy - 13 * $s), [float](7 * $s), [float](7 * $s))

    # Sauvegarde PNG
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

    # Nettoyage
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Generated: $outPath ($targetSize x $targetSize)"
}

Generate-CordelIcon 512 "public/icon-512.png"
Generate-CordelIcon 192 "public/icon-192.png"
Generate-CordelIcon 180 "public/apple-touch-icon.png"
