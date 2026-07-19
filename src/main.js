/**
 * archivim — Electron Main Process
 * Creates the native window, starts the backend server, handles lifecycle.
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 580,
      height: 720,
      minWidth: 480,
      minHeight: 600,
      icon: path.join(__dirname, "icon.ico"),
      title: "archivim",
      autoHideMenuBar: true,
      frame: false,
      titleBarStyle: "hidden",
      titleBarOverlay: {
        color: "#0a0a0f",
        symbolColor: "#a78bfa",
        height: 36,
      },
      backgroundColor: "#0a0a0f",
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // Start the backend server and load the app
    const server = require("./server.js");
    const PORT = server.PORT || 8384;

    // Wait briefly for the server to start, then load
    setTimeout(() => {
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    }, 200);

    // Show window when content is ready (no flash)
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  app.on("second-instance", () => {
    // If user tries to open a second instance, focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
