import "./server.ts";

setTimeout(() => {
  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  let edgeExe = edgePaths.find(p => { try { Deno.statSync(p); return true; } catch { return false; } });
  
  if (!edgeExe) {
    console.error("Edge not found!");
    Deno.exit(1);
  }

  const userDataDir = Deno.env.get("LocalAppData") + "\\archivim-profile";
  
  const command = new Deno.Command(edgeExe, {
    args: [
      "--app=http://127.0.0.1:8384",
      "--window-size=580,720",
      "--user-data-dir=${userDataDir}",
      "--disable-extensions",
      "--disable-default-apps",
      "--no-first-run",
      "--disable-sync"
    ]
  });
  
  const process = command.spawn();
  // Edge is managed by process.status but we let the server handle shutdown
}, 500);