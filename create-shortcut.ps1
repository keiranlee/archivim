# Create desktop shortcut for archivim with custom icon

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "archivim.lnk"

# -- Convert JPG to ICO using .NET --
$jpgPath = Get-ChildItem $AppDir -Filter "archivim_icon*.jpg" -ErrorAction SilentlyContinue | 
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

$icoPath = Join-Path $AppDir "icon.ico"

if ($jpgPath) {
    Add-Type -AssemblyName System.Drawing
    
    $img = [System.Drawing.Image]::FromFile($jpgPath.FullName)
    
    $sizes = @(256, 64, 48, 32, 16)
    $bitmaps = @()
    
    foreach ($size in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($img, 0, 0, $size, $size)
        $graphics.Dispose()
        $bitmaps += $bmp
    }
    
    $fs = [System.IO.File]::Create($icoPath)
    $bw = New-Object System.IO.BinaryWriter($fs)
    
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$bitmaps.Count)
    
    $headerSize = 6 + ($bitmaps.Count * 16)
    $dataOffset = $headerSize
    $imageData = @()
    
    foreach ($bmp in $bitmaps) {
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $ms.ToArray()
        $ms.Dispose()
        $imageData += ,@($pngBytes)
        
        $width = if ($bmp.Width -ge 256) { 0 } else { $bmp.Width }
        $height = if ($bmp.Height -ge 256) { 0 } else { $bmp.Height }
        
        $bw.Write([byte]$width)
        $bw.Write([byte]$height)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]$pngBytes.Length)
        $bw.Write([UInt32]$dataOffset)
        
        $dataOffset += $pngBytes.Length
    }
    
    foreach ($data in $imageData) {
        $bw.Write($data)
    }
    
    $bw.Close()
    $fs.Close()
    $img.Dispose()
    foreach ($bmp in $bitmaps) { $bmp.Dispose() }
    
    Write-Host "Icon olusturuldu: $icoPath" -ForegroundColor Green
} else {
    Write-Host "Icon dosyasi bulunamadi." -ForegroundColor Yellow
}

# -- Create Shortcut --
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$AppDir\archivim.vbs`""
$shortcut.WorkingDirectory = $AppDir
$shortcut.Description = "archivim - Muzik Indirici"
$shortcut.WindowStyle = 7

if (Test-Path $icoPath) {
    $shortcut.IconLocation = "$icoPath, 0"
}

$shortcut.Save()

Write-Host "Masaustu kisayolu olusturuldu: $ShortcutPath" -ForegroundColor Green
