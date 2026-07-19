/**
 * archivim — Preload Script
 * Provides a minimal, safe bridge between the renderer and main process.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("archivim", {
  platform: process.platform,
  isElectron: true,
});
