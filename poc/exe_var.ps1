param([switch]$Redirect, [string]$Mute = '')
$env:UNHOLIUM_SHOT = '1'; $env:UNHOLIUM_SHOT_FRAME = '300'; if ($Mute) { $env:UNHOLIUM_MUTE = '1' }
$sw = [Diagnostics.Stopwatch]::StartNew()
$args2 = @{ FilePath = 'D:\Unholium_native\dist\Unholium.exe'; PassThru = $true }
if ($Redirect) { $args2.RedirectStandardOutput = 'D:\Unholium_native\poc\out\exe_o.txt'; $args2.RedirectStandardError = 'D:\Unholium_native\poc\out\exe_e.txt' }
$p = Start-Process @args2
for ($i = 0; $i -lt 100 -and -not $p.HasExited; $i++) { Start-Sleep -Milliseconds 300 }
if (-not $p.HasExited) { 'still running after 30 s: stopping it'; Stop-Process -Id $p.Id -Force } else { "exit $($p.ExitCode) at $([math]::Round($sw.Elapsed.TotalSeconds, 1)) s" }
