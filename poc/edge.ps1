param([string]$Extra = 'edge_shots.js', [string]$Tag = 'edge', [string[]]$Flags = @('--disable-gpu'), [int]$Budget = 180000)
# The current build's engine (headless Edge, what WebView2 is) on the same files.
$R = 'D:\Unholium_native'; $P = "$R\poc"; $id = [guid]::NewGuid().ToString('n').Substring(0, 8)
$h = [IO.File]::ReadAllText("$R\index.html")
$h = $h.Replace('<head>', '<head><base href="file:///D:/Unholium_native/"><script src="poc/seed.js"></script>')
$h = $h.Replace('</body>', '<script src="poc/scene.js"></script><script src="poc/' + $Extra + '"></script></body>')
[IO.File]::WriteAllText("$P\p_$id.html", $h)
$a = @('--headless=new', '--no-first-run', '--allow-file-access-from-files', "--user-data-dir=D:\Unholium_native\tools\tmp\ue_$id", '--window-size=1280,720', '--hide-scrollbars', '--dump-dom') + $Flags + (@(if ($Budget -gt 0) { "--virtual-time-budget=$Budget" } else { "--timeout=100000" })) + ("file:///D:/Unholium_native/poc/p_$id.html")
$proc = Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList $a -RedirectStandardOutput "$P\o_$id.html" -RedirectStandardError "$P\e_$id.txt" -PassThru -WindowStyle Hidden
if (-not $proc.WaitForExit(280000)) { "TIMED OUT"; Stop-Process -Id $proc.Id -Force }
Start-Sleep -Milliseconds 500
$d = [IO.File]::ReadAllText("$P\o_$id.html")
foreach ($m in [regex]::Matches($d, 'data-n="([a-z]+)"[^>]*?src="data:image/png;base64,([A-Za-z0-9+/=]+)"|src="data:image/png;base64,([A-Za-z0-9+/=]+)"[^>]*?data-n="([a-z]+)"')) { $n = if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[4].Value }; $b = if ($m.Groups[2].Value) { $m.Groups[2].Value } else { $m.Groups[3].Value }; [IO.File]::WriteAllBytes("$P\out\${Tag}_$n.png", [Convert]::FromBase64String($b)); "saved $n" }
$e = [regex]::Match($d, '<pre id="res">(.*?)</pre>', 'Singleline'); if ($e.Success) { $e.Groups[1].Value } else { 'no result ' + $d.Length }
Remove-Item "$P\p_$id.html", "$P\o_$id.html", "$P\e_$id.txt" -ErrorAction SilentlyContinue
