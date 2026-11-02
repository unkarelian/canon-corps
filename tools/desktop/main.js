// Canon Corps desktop app (Electron). Electron bundles Chromium, so every player gets the engine the game
// was made and tested in (its Ogg and WebM audio and video, Web Audio timing), unlike system webviews.
// The game is served by the local service in server.js; the player's OpenRouter key stays in this process.
const { app, BrowserWindow, Menu, shell, safeStorage, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { createServer } = require("./server.js");

const DEV = !app.isPackaged;
const WEB = DEV ? path.join(__dirname, "..", "..", "game") : path.join(__dirname, "web");
const FIRST_PORT = Number(process.env.CC_PORT) || 47077; // fixed, so the game's saved notes and played worlds persist
// Test hook: CC_SNAPSHOT=out.png renders off-screen (no window appears), saves a screenshot after CC_SNAPSHOT_MS and quits.
const SNAPSHOT = process.env.CC_SNAPSHOT;

if (!app.requestSingleInstanceLock()) app.exit(0);
let win = null;
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

// a log file next to the player's data, to send with bug reports
const DATA = app.getPath("userData");
fs.mkdirSync(DATA, { recursive: true });
const logFile = fs.createWriteStream(path.join(DATA, "log.txt"), { flags: "a" });
for (const k of ["log", "warn", "error"]) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { orig(...a); logFile.write(`${new Date().toISOString()} ${a.map(String).join(" ")}\n`); };
}

// the key at rest: sealed with the OS keychain where Electron can reach one, plain (mode 600) otherwise
const secrets = {
  encrypt: (s) => safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s).toString("base64") : null,
  decrypt: (b) => safeStorage.decryptString(Buffer.from(b, "base64")),
};

async function listen() {
  for (let port = FIRST_PORT; port < FIRST_PORT + 10; port++) {
    try {
      await createServer({ web: WEB, data: DATA, port, secrets, onConnected: () => { if (win) { win.show(); win.focus(); } } });
      return port;
    } catch (e) { if (e.code !== "EADDRINUSE") throw e; console.warn(`port ${port} busy`); }
  }
  throw new Error("no free port");
}

ipcMain.handle("open-external", (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

app.whenReady().then(async () => {
  const port = await listen();
  const origin = `http://localhost:${port}`;
  console.log(`Canon Corps ${app.getVersion()} on ${origin}${DEV ? " (dev)" : ""}`);

  // macOS keeps the standard menu (Quit, copy and paste); elsewhere no menu bar over the desk
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);

  const prefs = { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, autoplayPolicy: "no-user-gesture-required", offscreen: !!SNAPSHOT };
  win = new BrowserWindow({ width: 1280, height: 860, minWidth: 960, minHeight: 640, title: "Canon Corps", backgroundColor: "#66705f",
    icon: path.join(__dirname, "icon.png"), show: false, webPreferences: prefs });
  if (!SNAPSHOT) win.once("ready-to-show", () => win.show());
  else win.webContents.once("did-finish-load", () => setTimeout(async () => {
    const report = await win.webContents.executeJavaScript(process.env.CC_SNAPSHOT_JS || "location.href").catch((e) => String(e));
    console.log("snapshot:", JSON.stringify(report));
    fs.writeFileSync(SNAPSHOT, (await win.webContents.capturePage()).toPNG());
    app.quit();
  }, Number(process.env.CC_SNAPSHOT_MS) || 4000));

  const external = (url) => !url.startsWith(origin + "/");
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) { shell.openExternal(url); return { action: "deny" }; } // OpenRouter pages open in the player's browser
    return { action: "allow", overrideBrowserWindowOptions: { width: 560, height: 600, parent: win, autoHideMenuBar: true, webPreferences: prefs } };
  });
  app.on("web-contents-created", (_e, wc) => {
    wc.on("will-navigate", (e, url) => { if (external(url)) { e.preventDefault(); shell.openExternal(url); } });
    wc.on("before-input-event", (e, input) => {
      if (input.type !== "keyDown") return;
      if (input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
      if (DEV && input.key === "I" && input.control && input.shift) { wc.toggleDevTools(); e.preventDefault(); }
    });
  });

  win.loadURL(origin + "/" + (process.env.CC_QUERY || ""));
  win.on("closed", () => { win = null; app.quit(); });
});

app.on("window-all-closed", () => app.quit());
