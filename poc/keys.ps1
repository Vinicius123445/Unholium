# Real key presses, one at a time, each only if the game's own window has focus: nothing can land anywhere else. No mouse.
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class U { [DllImport("user32.dll")] public static extern void keybd_event(byte v, byte s, uint f, UIntPtr e); [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint c, uint t);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool a);
public delegate bool CB(IntPtr h, IntPtr l); [DllImport("user32.dll")] static extern bool EnumWindows(CB c, IntPtr l); [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h); [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n); [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
public static string Info = ""; public static IntPtr Find(uint pid) { IntPtr found = IntPtr.Zero; EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p != pid || !IsWindowVisible(h)) return true; var c = new StringBuilder(128); GetClassName(h, c, 128); var t = new StringBuilder(128); GetWindowText(h, t, 128); Info = c + " / " + t; if (t.ToString() == "Unholium") { found = h; return false; } return true; }, IntPtr.Zero); return found; } }
'@
$env:UNHOLIUM_KEYLOG = 'D:\Unholium_native\poc\out\keys.txt'; $env:UNHOLIUM_DATA = 'D:\Unholium_native\tools\tmp\keys'; Remove-Item $env:UNHOLIUM_KEYLOG -ErrorAction SilentlyContinue
$p = Start-Process 'D:\Unholium_native\tools\node\node.exe' -ArgumentList 'D:\Unholium_native\native\main.js' -RedirectStandardError 'D:\Unholium_native\poc\out\keys_err.txt' -RedirectStandardOutput 'D:\Unholium_native\poc\out\keys_out.txt' -PassThru
$h = [IntPtr]::Zero; for ($i = 0; $i -lt 40 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 500; $h = [U]::Find([uint32]$p.Id) }
"window $h ($([U]::Info))"
if ($h -eq [IntPtr]::Zero) { 'game window not found; nothing sent'; Stop-Process -Id $p.Id -Force; exit }
Start-Sleep 6; [U]::SwitchToThisWindow($h, $true); Start-Sleep -Milliseconds 500
$sent = 0; $held = 0
foreach ($v in 0x57,0x41,0x53,0x44,0x51,0x59,0x4E,0x20,0x10,0x11,0x09,0x25,0x26,0x27,0x28,0x74,0x78,0x31,0xBA) {
  if ([U]::GetForegroundWindow() -ne $h) { $held++; continue }
  $s = [byte][U]::MapVirtualKey($v, 0); [U]::keybd_event([byte]$v, $s, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 50; [U]::keybd_event([byte]$v, $s, 2, [UIntPtr]::Zero); Start-Sleep -Milliseconds 70; $sent++
}
"sent $sent, held back $held"
Start-Sleep -Milliseconds 300
Stop-Process -Id $p.Id -Force; Start-Sleep -Milliseconds 300; Remove-Item $env:UNHOLIUM_DATA -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $env:UNHOLIUM_KEYLOG) { Get-Content $env:UNHOLIUM_KEYLOG } else { 'nothing arrived' }
