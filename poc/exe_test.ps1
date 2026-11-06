# Starts the built exe, looks at what windows it has, and closes it. Touches no other program.
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class W { public delegate bool CB(IntPtr h, IntPtr l); [DllImport("user32.dll")] static extern bool EnumWindows(CB c, IntPtr l); [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h); [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n); [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
public static List<string> Of(uint pid) { var r = new List<string>(); EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { var c = new StringBuilder(128); GetClassName(h, c, 128); var t = new StringBuilder(128); GetWindowText(h, t, 128); r.Add(c + " / " + t); } return true; }, IntPtr.Zero); return r; } }
'@
Remove-Item Env:UNHOLIUM_SHOT -ErrorAction SilentlyContinue
$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process 'D:\Unholium_native\dist\Unholium.exe' -PassThru
$first = $null; for ($i = 0; $i -lt 24; $i++) { Start-Sleep -Milliseconds 500; $w = [W]::Of([uint32]$p.Id); if ($w.Count -gt 0 -and -not $first) { $first = $sw.Elapsed.TotalSeconds; "window after $([math]::Round($first, 1)) s" }; if ($p.HasExited) { break } }
"windows: " + ($w -join ' | ')
$kids = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($p.Id)" | Select-Object -ExpandProperty Name; "child processes: " + ($kids -join ', ')
if (-not $p.HasExited) { "memory MB: " + [math]::Round((Get-Process -Id $p.Id).WorkingSet64 / 1048576); Stop-Process -Id $p.Id -Force } else { "exit code " + $p.ExitCode }
