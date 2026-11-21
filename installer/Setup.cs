using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
class Setup {
 static int Main(){
  Console.Title="Pasang RH Remote";
  string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"RH-Remote");
  try{
   Console.WriteLine("RH Remote: kontrol AutoHotkey, tutup jendela, dan shutdown sesuai izin Windows.");
   Console.WriteLine("Folder: "+root);
   Console.Write("Pasang pada laptop ini? [Y/N]: ");if(Console.ReadLine().Trim().ToUpperInvariant()!="Y")return 0;
   Directory.CreateDirectory(root);
   using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
   using(var archive=new ZipArchive(stream,ZipArchiveMode.Read)){
    foreach(var entry in archive.Entries){
     string target=Path.GetFullPath(Path.Combine(root,entry.FullName));
     if(!target.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Path paket tidak valid");
     if(String.IsNullOrEmpty(entry.Name)){Directory.CreateDirectory(target);continue;}
     Directory.CreateDirectory(Path.GetDirectoryName(target));entry.ExtractToFile(target,true);
    }
   }
   Type shellType=Type.GetTypeFromProgID("WScript.Shell");dynamic shell=Activator.CreateInstance(shellType);
   string desktop=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"RH Remote.lnk");
   dynamic shortcut=shell.CreateShortcut(desktop);shortcut.TargetPath=Path.Combine(root,"client.exe");shortcut.WorkingDirectory=root;shortcut.Description="RH Remote Agent - jendela terlihat";shortcut.Save();
   Console.Write("Mulai otomatis setelah login Windows, dengan jendela agent terlihat? [Y/N]: ");
   if(Console.ReadLine().Trim().ToUpperInvariant()=="Y"){
    dynamic startup=shell.CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup),"RH Remote.lnk"));startup.TargetPath=Path.Combine(root,"client.exe");startup.WorkingDirectory=root;startup.Save();
   }
   Console.WriteLine("Pemasangan selesai. Login akun dashboard satu kali untuk mendaftarkan laptop.");
   var info=new ProcessStartInfo(Path.Combine(root,"client.exe"));info.WorkingDirectory=root;info.UseShellExecute=true;Process.Start(info);return 0;
  }catch(Exception e){Console.WriteLine("Pemasangan gagal: "+e.Message);Console.WriteLine("Jika agent lama sedang berjalan, tutup dahulu lalu ulangi.");Console.ReadLine();return 1;}
 }
}
