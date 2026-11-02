// What the page may ask of the desktop app: only to open a web page in the player's own browser
// (signing in to OpenRouter happens there, where their password manager and existing session are).
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ccDesktop", { openExternal: (url) => ipcRenderer.invoke("open-external", url) });
