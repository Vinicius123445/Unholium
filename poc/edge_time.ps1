param([string[]]$Flags = @())
# real clock (no virtual time); memory: every Edge process of this profile, sampled while it runs
$R = 'D:\Unholium_native'; $Pd = "$R\poc"; $id = [guid]::NewGuid().ToString('n').Substring(0, 8)
$h = [IO.File]::ReadAllText("$R\index.html").Replace('<head>', '<head><base href="file:///D:/Unholium_native/"><script src="poc/seed.js"></script>').Replace('</body>', '<script src="poc/timing.js"></script><script src="poc/edge_time.js"></script></body>')
[IO.File]::WriteAllText("$Pd\p_$id.html", $h)
$a = @('--headless=new', '--no-first-run', '--allow-file-access-from-files', "--user-data-dir=$R\tools\tmp\ue_$id", '--window-size=1280,720', '--hide-scrollbars', '--dump-dom') + $Flags + ("file:///D:/Unholium_native/poc/p_$id.html")
$proc = Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList $a -RedirectStandardOutput "$Pd\o_$id.html" -RedirectStandardError "$Pd\e_$id.txt" -PassThru -WindowStyle Hidden
$peak = 0; $sw = [Diagnostics.Stopwatch]::StartNew()
while (-not $proc.HasExited -and $sw.Elapsed.TotalSeconds -lt 200) { $ids = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*ue_$id*" } | Select-Object -ExpandProperty ProcessId; $sum = 0; foreach ($i in $ids) { try { $sum += (Get-Process -Id $i -ErrorAction Stop).WorkingSet64 } catch { } }; if ($sum -gt $peak) { $peak = $sum }; Start-Sleep -Milliseconds 400 }
if (-not $proc.HasExited) { 'TIMED OUT'; Stop-Process -Id $proc.Id -Force }
Start-Sleep -Milliseconds 500
$d = [IO.File]::ReadAllText("$Pd\o_$id.html"); $e = [regex]::Match($d, '<pre id="res">(.*?)</pre>', 'Singleline')
if ($e.Success) { $e.Groups[1].Value } else { 'no result ' + $d.Length }
"peakAllProcessesMB $([math]::Round($peak / 1048576)) seconds $([math]::Round($sw.Elapsed.TotalSeconds))"
$txt = Get-Content "$Pd\e_$id.txt" -ErrorAction SilentlyContinue | Select-String 'GPU|SwiftShader|ANGLE' | Select-Object -First 2; $txt
Remove-Item "$Pd\p_$id.html", "$Pd\o_$id.html", "$Pd\e_$id.txt" -ErrorAction SilentlyContinue
Remove-Item "$R\tools\tmp\ue_$id" -Recurse -Force -ErrorAction SilentlyContinue
