# Generate the Douyin mini-game store icon (1024 master + 512 upload size).
# The icon is deliberately square with a full-bleed background because the
# platform asks for a square image, not a pre-rounded avatar.

Add-Type -AssemblyName System.Drawing

$W = 1024
$H = 1024
$outDir = Join-Path $PSScriptRoot '..\store'
$outDir = [System.IO.Path]::GetFullPath($outDir)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-PointF {
    param([float]$X, [float]$Y)
    New-Object System.Drawing.PointF -ArgumentList $X, $Y
}

function New-RectF {
    param([float]$X, [float]$Y, [float]$Width, [float]$Height)
    New-Object System.Drawing.RectangleF -ArgumentList $X, $Y, $Width, $Height
}

function Add-RoundedRect {
    param(
        [System.Drawing.Drawing2D.GraphicsPath]$Path,
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )
    $d = $Radius * 2
    $Path.AddArc($X, $Y, $d, $d, 180, 90)
    $Path.AddArc($X + $Width - $d, $Y, $d, $d, 270, 90)
    $Path.AddArc($X + $Width - $d, $Y + $Height - $d, $d, $d, 0, 90)
    $Path.AddArc($X, $Y + $Height - $d, $d, $d, 90, 90)
    $Path.CloseFigure()
}

function New-RoundedPath {
    param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect -Path $path -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
    return $path
}

function Add-RadialGlow {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$CX,
        [float]$CY,
        [float]$RX,
        [float]$RY,
        [System.Drawing.Color]$Center,
        [System.Drawing.Color]$Edge
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($CX - $RX, $CY - $RY, $RX * 2, $RY * 2)
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $brush.CenterPoint = New-PointF -X $CX -Y $CY
    $brush.CenterColor = $Center
    $brush.SurroundColors = [System.Drawing.Color[]]@($Edge)
    $Graphics.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
}

function Add-Coin {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$X,
        [float]$Y,
        [float]$Diameter,
        [int]$Alpha = 255
    )
    $rect = New-RectF -X $X -Y $Y -Width $Diameter -Height $Diameter
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb($Alpha, 255, 239, 151),
        [System.Drawing.Color]::FromArgb($Alpha, 191, 121, 18),
        90.0
    )
    $Graphics.FillEllipse($brush, $rect)
    $edge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($Alpha, 255, 212, 94), [float]($Diameter * 0.035))
    $Graphics.DrawEllipse($edge, $rect)
    $innerX = [float]($X + $Diameter * 0.16)
    $innerY = [float]($Y + $Diameter * 0.16)
    $innerD = [float]($Diameter * 0.68)
    $inner = New-RectF -X $innerX -Y $innerY -Width $innerD -Height $innerD
    $innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([Math]::Min($Alpha, 180), 255, 245, 190), [float]($Diameter * 0.018))
    $Graphics.DrawEllipse($innerPen, $inner)
    $brush.Dispose()
    $edge.Dispose()
    $innerPen.Dispose()
}

function Add-Sparkle {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$CX,
        [float]$CY,
        [float]$Size,
        [System.Drawing.Color]$Color
    )
    $points = [System.Drawing.PointF[]]@(
        (New-PointF -X $CX -Y ($CY - $Size)),
        (New-PointF -X ($CX + $Size * 0.22) -Y ($CY - $Size * 0.22)),
        (New-PointF -X ($CX + $Size) -Y $CY),
        (New-PointF -X ($CX + $Size * 0.22) -Y ($CY + $Size * 0.22)),
        (New-PointF -X $CX -Y ($CY + $Size)),
        (New-PointF -X ($CX - $Size * 0.22) -Y ($CY + $Size * 0.22)),
        (New-PointF -X ($CX - $Size) -Y $CY),
        (New-PointF -X ($CX - $Size * 0.22) -Y ($CY - $Size * 0.22))
    )
    $brush = New-Object System.Drawing.SolidBrush($Color)
    $Graphics.FillPolygon($brush, $points)
    $brush.Dispose()
}

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Background: a deep stage-purple gradient.
$bgRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $W, $H
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(30, 20, 66),
    [System.Drawing.Color]::FromArgb(5, 5, 14),
    90.0
)
$g.FillRectangle($bg, $bgRect)

# Warm spotlight behind the case.
Add-RadialGlow -Graphics $g -CX 512 -CY 420 -RX 470 -RY 470 `
    -Center ([System.Drawing.Color]::FromArgb(150, 255, 190, 70)) `
    -Edge ([System.Drawing.Color]::FromArgb(0, 255, 190, 70))

# Stage light rays.
$rayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 255, 220, 110))
for ($i = 0; $i -lt 12; $i++) {
    $angleRad = ($i * 30.0 + 15.0) * [Math]::PI / 180.0
    $spread = 7.0 * [Math]::PI / 180.0
    $p1 = New-PointF -X 512 -Y 420
    $p2 = New-PointF -X (512 + [Math]::Cos($angleRad - $spread) * 760) -Y (420 + [Math]::Sin($angleRad - $spread) * 760)
    $p3 = New-PointF -X (512 + [Math]::Cos($angleRad + $spread) * 760) -Y (420 + [Math]::Sin($angleRad + $spread) * 760)
    $g.FillPolygon($rayBrush, [System.Drawing.PointF[]]@($p1, $p2, $p3))
}
$rayBrush.Dispose()

# Soft floor shadow.
$shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$shadowPath.AddEllipse(168, 712, 688, 158)
$shadowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($shadowPath)
$shadowBrush.CenterPoint = New-PointF -X 512 -Y 791
$shadowBrush.CenterColor = [System.Drawing.Color]::FromArgb(155, 0, 0, 0)
$shadowBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$g.FillPath($shadowBrush, $shadowPath)
$shadowBrush.Dispose()
$shadowPath.Dispose()

# Coins around the case.
Add-Coin -Graphics $g -X 118 -Y 574 -Diameter 138 -Alpha 238
Add-Coin -Graphics $g -X 792 -Y 590 -Diameter 116 -Alpha 230
Add-Coin -Graphics $g -X 760 -Y 238 -Diameter 92 -Alpha 200
Add-Coin -Graphics $g -X 170 -Y 286 -Diameter 72 -Alpha 180

# Four-point sparkles.
Add-Sparkle -Graphics $g -CX 248 -CY 224 -Size 30 -Color ([System.Drawing.Color]::FromArgb(220, 255, 238, 170))
Add-Sparkle -Graphics $g -CX 830 -CY 430 -Size 22 -Color ([System.Drawing.Color]::FromArgb(180, 255, 226, 130))
Add-Sparkle -Graphics $g -CX 178 -CY 800 -Size 18 -Color ([System.Drawing.Color]::FromArgb(150, 255, 226, 150))
Add-Sparkle -Graphics $g -CX 870 -CY 780 -Size 26 -Color ([System.Drawing.Color]::FromArgb(160, 255, 238, 180))

# Briefcase handle (behind the body).
$handlePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 150, 91, 24), 46.0)
$handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawArc($handlePen, 360, 238, 304, 252, 180, 180)
$handleHighlight = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(185, 255, 219, 144), 9.0)
$handleHighlight.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$handleHighlight.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawArc($handleHighlight, 374, 252, 276, 224, 188, 164)
$handlePen.Dispose()
$handleHighlight.Dispose()

# Briefcase body.
$bodyRect = New-RectF -X 196 -Y 366 -Width 632 -Height 438
$bodyPath = New-RoundedPath -X 196 -Y 366 -Width 632 -Height 438 -Radius 58
$bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bodyRect,
    [System.Drawing.Color]::FromArgb(255, 166, 103, 35),
    [System.Drawing.Color]::FromArgb(255, 52, 27, 10),
    90.0
)
$g.FillPath($bodyBrush, $bodyPath)
$bodyEdge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 205, 92), 11.0)
$bodyEdge.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawPath($bodyEdge, $bodyPath)

# Inner leather trim.
$innerPath = New-RoundedPath -X 225 -Y 395 -Width 574 -Height 380 -Radius 40
$innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 224, 150), 3.0)
$g.DrawPath($innerPen, $innerPath)

# Light band across the top of the case.
$bandRect = New-RectF -X 220 -Y 432 -Width 584 -Height 34
$bandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bandRect,
    [System.Drawing.Color]::FromArgb(0, 255, 236, 170),
    [System.Drawing.Color]::FromArgb(150, 255, 226, 140),
    0.0
)
$g.FillRectangle($bandBrush, 236, 432, 552, 34)

# Corner hardware.
$cornerRect = New-RectF -X 0 -Y 0 -Width 44 -Height 100
$cornerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $cornerRect,
    [System.Drawing.Color]::FromArgb(255, 255, 226, 145),
    [System.Drawing.Color]::FromArgb(255, 187, 116, 18),
    90.0
)
$leftCorner = New-RoundedPath -X 181 -Y 382 -Width 38 -Height 116 -Radius 12
$rightCorner = New-RoundedPath -X 805 -Y 382 -Width 38 -Height 116 -Radius 12
$g.FillPath($cornerBrush, $leftCorner)
$g.FillPath($cornerBrush, $rightCorner)

# Gold clasp at the bottom of the case.
$claspPath = New-RoundedPath -X 462 -Y 690 -Width 100 -Height 46 -Radius 13
$claspRect = New-RectF -X 462 -Y 690 -Width 100 -Height 46
$claspBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $claspRect,
    [System.Drawing.Color]::FromArgb(255, 255, 241, 174),
    [System.Drawing.Color]::FromArgb(255, 204, 129, 20),
    90.0
)
$g.FillPath($claspBrush, $claspPath)
$claspPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 91, 52, 10), 4.0)
$g.DrawPath($claspPen, $claspPath)

# Big embossed question mark: mystery, not real money.
$qFont = New-Object System.Drawing.Font('Arial Black', 300.0, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$qRect = New-RectF -X 216 -Y 372 -Width 592 -Height 322
$qFormat = New-Object System.Drawing.StringFormat
$qFormat.Alignment = [System.Drawing.StringAlignment]::Center
$qFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$qShadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(190, 42, 20, 4))
$qShadowRect = New-RectF -X 226 -Y 383 -Width 592 -Height 322
$g.DrawString('?', $qFont, $qShadowBrush, $qShadowRect, $qFormat)
$qBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $qRect,
    [System.Drawing.Color]::FromArgb(255, 255, 249, 205),
    [System.Drawing.Color]::FromArgb(255, 219, 151, 28),
    90.0
)
$g.DrawString('?', $qFont, $qBrush, $qRect, $qFormat)

# Title: 一掷千金.
$title = -join ([char[]]@(0x4E00, 0x63B7, 0x5343, 0x91D1))
$titleFont = New-Object System.Drawing.Font('Microsoft YaHei UI', 86.0, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$titleRect = New-RectF -X 0 -Y 842 -Width 1024 -Height 130
$titleShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 3, 3, 10))
$titleShadowRect = New-RectF -X 5 -Y 850 -Width 1024 -Height 130
$g.DrawString($title, $titleFont, $titleShadow, $titleShadowRect, $qFormat)
$titleBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $titleRect,
    [System.Drawing.Color]::FromArgb(255, 255, 252, 224),
    [System.Drawing.Color]::FromArgb(255, 255, 196, 63),
    90.0
)
$g.DrawString($title, $titleFont, $titleBrush, $titleRect, $qFormat)

# Small gold divider under the title.
$dividerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(170, 255, 212, 94), 3.0)
$g.DrawLine($dividerPen, 350, 978, 674, 978)

# Vignette around the edges (keeps the icon readable on light and dark feeds).
$vignettePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$vignettePath.AddEllipse(-120, -120, 1264, 1264)
$vignetteBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($vignettePath)
$vignetteBrush.CenterPoint = New-PointF -X 512 -Y 470
$vignetteBrush.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
$vignetteBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
$g.FillPath($vignetteBrush, $vignettePath)

$icon1024 = Join-Path $outDir 'icon-1024.png'
$icon512 = Join-Path $outDir 'icon-512.png'
$bmp.Save($icon1024, [System.Drawing.Imaging.ImageFormat]::Png)

# Downscale with clamped edge sampling so the upload icon stays fully opaque.
$small = New-Object System.Drawing.Bitmap(512, 512)
$sg = [System.Drawing.Graphics]::FromImage($small)
$sg.Clear([System.Drawing.Color]::FromArgb(255, 5, 5, 14))
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$destRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, 512, 512
$imageAttr = New-Object System.Drawing.Imaging.ImageAttributes
$imageAttr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
$sg.DrawImage($bmp, $destRect, 0, 0, $W, $H, [System.Drawing.GraphicsUnit]::Pixel, $imageAttr)
$small.Save($icon512, [System.Drawing.Imaging.ImageFormat]::Png)

$imageAttr.Dispose()
$sg.Dispose()
$small.Dispose()
$qFont.Dispose()
$titleFont.Dispose()
$qShadowBrush.Dispose()
$qBrush.Dispose()
$titleShadow.Dispose()
$titleBrush.Dispose()
$dividerPen.Dispose()
$vignetteBrush.Dispose()
$vignettePath.Dispose()
$claspPen.Dispose()
$claspBrush.Dispose()
$cornerBrush.Dispose()
$leftCorner.Dispose()
$rightCorner.Dispose()
$claspPath.Dispose()
$innerPen.Dispose()
$innerPath.Dispose()
$bodyEdge.Dispose()
$bodyBrush.Dispose()
$bodyPath.Dispose()
$bandBrush.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Host ('Generated: ' + $icon1024)
Write-Host ('Generated: ' + $icon512)
