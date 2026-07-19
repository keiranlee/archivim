# archivim Launcher
# Starts Deno server hidden, opens Edge in app mode, cleans up on exit.

$ErrorActionPreference = "SilentlyContinue"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DenoExe = "C:\Users\crazy\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe"
$Port = 8384
$Url = "http://127.0.0.1:$Port"

Get-Process -Name "deno" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = $$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdline -and $cmdline -like "*server.ts*") {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

$serverProcess = Start-Process -FilePath $DenoExe -ArgumentList "run", "--allow-net", "--allow-read", "--allow-run", "--allow-env", "`"$AppDir\server.ts`"" -WorkingDirectory $AppDir -WindowStyle Hidden -PassThru

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 400
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
}

if (-not $ready) {
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
    exit 1
}

$edgePaths = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
)

$edgeExe = $null
foreach ($path in $edgePaths) {
    if (Test-Path $path) {
        $edgeExe = $path
        break
    }
}

if (-not $edgeExe) {
    Start-Process $Url
    while (-not $serverProcess.HasExited) { Start-Sleep -Seconds 2 }
    exit 0
}

$userDataDir = "$env:LocalAppData\archivim-profile"

Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$x = [math]::Round(($screen.Width - 580) / 2)
$y = [math]::Round(($screen.Height - 720) / 2)

$browserProcess = Start-Process -FilePath $edgeExe -ArgumentList "--app=$Url", "--window-size=580,720", "--window-position=$x,$y", "--user-data-dir=`"$userDataDir`"", "--disable-extensions", "--disable-default-apps", "--no-first-run", "--disable-sync" -PassThru

$browserProcess.WaitForExit()

if ($serverProcess -and !$serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
}