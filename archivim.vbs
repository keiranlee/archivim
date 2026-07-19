' archivim — Silent Launcher
' Runs the PowerShell launcher without showing any console window.

Set WshShell = CreateObject("WScript.Shell")
AppDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & AppDir & "\launcher.ps1""", 0, False
