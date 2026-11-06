# Full screen, then Esc, one real key, only if the game's own window has focus. No mouse.
param([string]$Note = 'run')
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public class E {
 [DllImport("user32.dll")] public static extern void keybd_event(byte v, byte s, uint f, UIntPtr e);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool b);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
 [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
 public struct R { public int L, T, Ri, B; }
 public delegate bool CB(IntPtr h, IntPtr l); [DllImport("user32.dll")] static extern bool EnumWindows(CB c, IntPtr l);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 public static IntPtr Find(uint pid) { IntPtr f = IntPtr.Zero; EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { var s = new StringBuilder(64); GetWindowText(h, s, 64); if (s.ToString() == "Unholium") { f = h; return false; } } return true; }, IntPtr.Zero); return f; }
 public static string Rect(IntPtr h) { R r; GetWindowRect(h, out r); return (r.Ri - r.L) + "x" + (r.B - r.T) + " at " + r.L + "," + r.T; }
}
'@
$d = 'D:\Unholium_native\tools\tmp\esc'; Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force "$d\storage" | Out-Null
'{"fullscreen":true}' | Out-File -Encoding ascii -NoNewline (Join-Path $d 'storage/rpgbase_settings.json'); $env:UNHOLIUM_DATA = $d; $env:UNHOLIUM_KEYLOG = "$d\keys.txt"; $env:UNHOLIUM_MUTE = '1';
$p = Start-Process 'D:\Unholium_native\tools\node\node.exe' -ArgumentList 'D:\Unholium_native\native\main.js' -WorkingDirectory 'D:\Unholium_native\native' -RedirectStandardError "$d\err.txt" -RedirectStandardOutput "$d\out.txt" -PassThru
$h = [IntPtr]::Zero; for ($i = 0; $i -lt 40 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 500; $h = [E]::Find([uint32]$p.Id) }
if ($h -eq [IntPtr]::Zero) { 'window not found'; Stop-Process -Id $p.Id -Force; exit }
"screen $([E]::GetSystemMetrics(0))x$([E]::GetSystemMetrics(1)); window at start $([E]::Rect($h))"
Start-Sleep 7
[E]::SwitchToThisWindow($h, $true); Start-Sleep -Milliseconds 600
"before Esc $([E]::Rect($h)), focused $([E]::GetForegroundWindow() -eq $h)"
if ([E]::GetForegroundWindow() -eq $h) { [E]::keybd_event(0x1B, 1, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [E]::keybd_event(0x1B, 1, 2, [UIntPtr]::Zero) } else { 'not focused: no key sent' }
Start-Sleep -Milliseconds 1500
"after Esc $([E]::Rect($h))"
Stop-Process -Id $p.Id -Force; Start-Sleep -Milliseconds 300
if (Test-Path "$d\keys.txt.fs") { 'fullscreen events:'; Get-Content "$d\keys.txt.fs" }
if (Test-Path "$d\keys.txt") { Get-Content "$d\keys.txt" | Select-Object -Last 4 }
