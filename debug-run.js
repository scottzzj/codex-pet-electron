const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const COLLAPSED_WINDOW_HEIGHT = 320;
const EXPANDED_WINDOW_HEIGHT = 520;

function log(message) {
  process.stdout.write(String(message) + "\n");
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 420,
    height: COLLAPSED_WINDOW_HEIGHT,
    show: true,
    transparent: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(process.cwd(), "src", "preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  ipcMain.handle("pet:setExpanded", function (_event, payload) {
    const bounds = win.getBounds();
    win.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: payload && payload.expanded ? EXPANDED_WINDOW_HEIGHT : COLLAPSED_WINDOW_HEIGHT
    });
    return win.getBounds();
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log("[console:" + level + "] " + message + " (" + sourceId + ":" + line + ")");
  });

  win.webContents.on("did-fail-load", (_event, code, desc, url) => {
    log("did-fail-load " + code + " " + desc + " " + url);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    log("render-process-gone " + JSON.stringify(details));
  });

  win.webContents.on("did-finish-load", () => {
    log("did-finish-load");
    setTimeout(async () => {
      try {
        await win.webContents.executeJavaScript(
          "document.getElementById('pet-badge').click();",
          true
        );
        await new Promise(function (resolve) {
          setTimeout(resolve, 800);
        });
        const image = await win.webContents.capturePage();
        const outputPath = path.join(process.cwd(), "debug-capture.png");
        fs.writeFileSync(outputPath, image.toPNG());
        log("capture-saved " + outputPath);
      } catch (error) {
        log("capture-error " + error.message);
      } finally {
        app.quit();
      }
    }, 2500);
  });

  win.loadFile(path.join(process.cwd(), "src", "renderer", "index.html"));
});
