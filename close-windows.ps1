param([switch]$ListOnly)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class RemoteWindowClose {
    private delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll", SetLastError=true)] private static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowTextLength(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", SetLastError=true)] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll", SetLastError=true)] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll", SetLastError=true)] private static extern bool SetThreadDesktop(IntPtr desktop);
    [DllImport("user32.dll")] private static extern IntPtr GetThreadDesktop(uint threadId);
    [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    public static Dictionary<string,int> Run(bool listOnly) {
        var counts = new Dictionary<string,int>{{"requested",0},{"skipped",0},{"failed",0}};
        Exception failure = null;
        var worker = new Thread(delegate() {
            IntPtr input = IntPtr.Zero;
            IntPtr original = GetThreadDesktop(GetCurrentThreadId());
            try {
                // Select the active desktop without elevation or changing the user's visible desktop.
                input = OpenInputDesktop(0,false,0x0040 | 0x0001 | 0x0080);
                if(input == IntPtr.Zero || !SetThreadDesktop(input)) throw new Win32Exception(Marshal.GetLastWin32Error(),"Desktop pengguna tidak dapat diakses. Jalankan agent dari desktop pengguna yang login.");
                int session = Process.GetCurrentProcess().SessionId;
                var protectedProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase){"client","node","cloudflared","powershell","pwsh","WindowsTerminal","conhost","OpenConsole"};
                EnumProc callback = delegate(IntPtr window,IntPtr parameter) {
                    if(!IsWindowVisible(window) || GetWindowTextLength(window)==0) return true;
                    var name = new StringBuilder(256);
                    GetClassName(window,name,256);
                    string c=name.ToString();
                    if(c=="Progman" || c=="WorkerW" || c=="Shell_TrayWnd" || c=="Shell_SecondaryTrayWnd" || c=="ConsoleWindowClass" || c=="CASCADIA_HOSTING_WINDOW_CLASS") {counts["skipped"]++;return true;}
                    uint ownerId;
                    GetWindowThreadProcessId(window,out ownerId);
                    try {
                        using(var owner=Process.GetProcessById((int)ownerId)) {
                            if(owner.SessionId!=session || protectedProcesses.Contains(owner.ProcessName)) {counts["skipped"]++;return true;}
                            // WM_CLOSE preserves normal application save prompts.
                            if(listOnly || PostMessage(window,0x0010,IntPtr.Zero,IntPtr.Zero))counts["requested"]++;
                            else counts["failed"]++;
                        }
                    } catch {counts["failed"]++;}
                    return true;
                };
                if(!EnumWindows(callback,IntPtr.Zero))throw new Win32Exception(Marshal.GetLastWin32Error(),"Pemeriksaan jendela gagal.");
            } catch(Exception error) {failure=error;}
            finally {if(original!=IntPtr.Zero)SetThreadDesktop(original);if(input!=IntPtr.Zero)CloseDesktop(input);}
        });
        worker.Start();
        if(!worker.Join(8000))throw new TimeoutException("Pemeriksaan desktop terlalu lama.");
        if(failure!=null)throw failure;
        return counts;
    }
}
'@
[RemoteWindowClose]::Run([bool]$ListOnly) | ConvertTo-Json -Compress
