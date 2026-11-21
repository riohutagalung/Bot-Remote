using System;
using System.Diagnostics;
using System.IO;
class Client {
 static int Run(string file) {
  string root=AppDomain.CurrentDomain.BaseDirectory;
  var info=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"\""+Path.Combine(root,file)+"\"");
  info.WorkingDirectory=root;info.UseShellExecute=false;info.CreateNoWindow=false;
  info.EnvironmentVariables["ALLOW_SYSTEM_CONTROL"]="1";
  using(var child=Process.Start(info)){child.WaitForExit();return child.ExitCode;}
 }
 static int Main(){Console.Title="RH Remote Agent - Ctrl+C untuk berhenti";try{if(Run("enroll-agent.cjs")!=0){Console.ReadLine();return 1;}return Run("central-agent.cjs");}catch(Exception e){Console.WriteLine(e.Message);Console.ReadLine();return 1;}}
}
