const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require("electron");
const koffi = require("koffi");

let petWindow = null;
let focusDetailWindow = null;
let focusDetailState = null;
let isPetDragging = false;
let isFixingFocusDetailBounds = false;
let nativeDragState = {
  entered: false,
  exited: false
};
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const POINT = process.platform === "win32"
  ? koffi.struct("POINT", {
    x: "long",
    y: "long"
  })
  : null;
const HWND = process.platform === "win32"
  ? koffi.pointer("HWND", koffi.opaque())
  : null;
const user32 = process.platform === "win32"
  ? koffi.load("user32.dll")
  : null;
const ReleaseCapture = user32
  ? user32.func("bool __stdcall ReleaseCapture(void)")
  : null;
const SendMessageW = user32
  ? user32.func("intptr_t __stdcall SendMessageW(HWND hWnd, uint32_t Msg, uintptr_t wParam, intptr_t lParam)")
  : null;
const GetCursorPos = user32
  ? user32.func("bool __stdcall GetCursorPos(_Out_ POINT *lpPoint)")
  : null;

const WINDOW_WIDTH = 356;
const COLLAPSED_WINDOW_HEIGHT = 320;
const EXPANDED_WINDOW_HEIGHT = 520;
const DETAIL_WINDOW_WIDTH = 320;
const DETAIL_WINDOW_HEIGHT = 272;
const DEFAULT_FOCUS_SOUND_DIR = path.join(__dirname, "..", "assets", "sounds");
const DEFAULT_FOCUS_SOUND_NAMES = [
  "focus-default.wav",
  "focus-default.mp3",
  "focus-default.ogg",
  "focus-default.m4a"
];
const SETTINGS_FILE_NAME = "pet-settings.json";
const WM_NCLBUTTONDOWN = 0x00A1;
const WM_SYSCOMMAND = 0x0112;
const WM_ENTERSIZEMOVE = 0x0231;
const WM_EXITSIZEMOVE = 0x0232;
const HTCAPTION = 0x0002;
const SC_MOVE = 0xF010;

if (!gotSingleInstanceLock) {
  app.quit();
}

function readCodexGlobalState() {
  try {
    const statePath = path.join(os.homedir(), ".codex", ".codex-global-state.json");
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function readAppSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
  } catch (_error) {
    return {};
  }
}

function writeAppSettings(settings) {
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
  } catch (_error) {
    return;
  }
}

function setCustomFocusSoundPath(soundPath) {
  const nextSettings = readAppSettings();

  if (typeof soundPath === "string" && soundPath.length > 0) {
    nextSettings.customFocusSoundPath = soundPath;
  } else {
    delete nextSettings.customFocusSoundPath;
  }

  writeAppSettings(nextSettings);
}

function resolveFocusSoundPath() {
  const settings = readAppSettings();
  const customPath = settings.customFocusSoundPath;

  if (typeof customPath === "string" && customPath.length > 0 && fs.existsSync(customPath)) {
    return customPath;
  }

  for (const fileName of DEFAULT_FOCUS_SOUND_NAMES) {
    const candidatePath = path.join(DEFAULT_FOCUS_SOUND_DIR, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function readFocusSoundDataUrl() {
  try {
    const focusSoundPath = resolveFocusSoundPath();
    if (!focusSoundPath) {
      return null;
    }

    const soundBuffer = fs.readFileSync(focusSoundPath);
    const soundExt = path.extname(focusSoundPath).slice(1).toLowerCase() || "wav";
    const mimeType = soundExt === "mp3"
      ? "audio/mpeg"
      : (soundExt === "ogg" ? "audio/ogg" : (soundExt === "m4a" ? "audio/mp4" : "audio/wav"));

    return "data:" + mimeType + ";base64," + soundBuffer.toString("base64");
  } catch (_error) {
    return null;
  }
}

function clampBoundsToWorkArea(bounds, workArea) {
  const maxX = workArea.x + workArea.width - WINDOW_WIDTH;
  const maxY = workArea.y + workArea.height - EXPANDED_WINDOW_HEIGHT;

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY)
  };
}

function clampWindowRectToDisplay(bounds, workArea, width, height) {
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY)
  };
}

function resolveInitialBounds() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const state = readCodexGlobalState();
  const overlayBounds = state?.["electron-avatar-overlay-bounds"];

  if (
    overlayBounds &&
    typeof overlayBounds.x === "number" &&
    typeof overlayBounds.y === "number"
  ) {
    return clampBoundsToWorkArea(
      {
        x: Math.round(overlayBounds.x),
        y: Math.round(overlayBounds.y)
      },
      workArea
    );
  }

  return clampBoundsToWorkArea(
    {
      x: workArea.x + workArea.width - WINDOW_WIDTH - 32,
      y: workArea.y + 32
    },
    workArea
  );
}

function createPetWindow() {
  const initialBounds = resolveInitialBounds();

  petWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: COLLAPSED_WINDOW_HEIGHT,
    x: initialBounds.x,
    y: initialBounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  petWindow.on("move", function () {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-window-bounds-changed", petWindow.getBounds());
    }
  });

  petWindow.hookWindowMessage(WM_ENTERSIZEMOVE, function () {
    isPetDragging = true;
    nativeDragState.entered = true;
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-native-drag-state", { dragging: true });
    }
  });
  petWindow.hookWindowMessage(WM_EXITSIZEMOVE, function () {
    isPetDragging = false;
    nativeDragState.exited = true;
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-native-drag-state", { dragging: false });
      petWindow.webContents.send("pet-window-bounds-changed", petWindow.getBounds());
    }
  });

  petWindow.on("closed", function () {
    closeFocusDetailWindow();
    petWindow = null;
  });
}

function mapMenuItem(item) {
  if (item.type === "separator") {
    return { type: "separator" };
  }

  const mapped = {
    id: item.id,
    label: item.label,
    enabled: item.enabled !== false
  };

  if (Array.isArray(item.submenu) && item.submenu.length > 0) {
    mapped.submenu = item.submenu.map(mapMenuItem);
    return mapped;
  }

  mapped.click = function () {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-menu-action", { id: item.id });
    }
  };

  return mapped;
}

function buildPetMenu(items) {
  return Menu.buildFromTemplate(items.map(mapMenuItem));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeContextMenuItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce(function (result, item) {
    if (!item || typeof item !== "object") {
      return result;
    }

    if (item.type === "separator") {
      result.push({ type: "separator" });
      return result;
    }

    if (typeof item.id !== "string" || typeof item.label !== "string") {
      return result;
    }

    const sanitized = {
      id: item.id,
      label: item.label,
      enabled: item.enabled !== false
    };

    if (Array.isArray(item.submenu) && item.submenu.length > 0) {
      sanitized.submenu = sanitizeContextMenuItems(item.submenu);
    }

    result.push(sanitized);
    return result;
  }, []);
}

function resolveFocusDetailBounds() {
  const petBounds = petWindow ? petWindow.getBounds() : { x: 0, y: 0, width: WINDOW_WIDTH, height: COLLAPSED_WINDOW_HEIGHT };
  const display = screen.getDisplayMatching(petBounds);
  const workArea = display.workArea;
  const rightX = petBounds.x + petBounds.width + 12;
  const leftX = petBounds.x - DETAIL_WINDOW_WIDTH - 12;
  const canPlaceRight = rightX + DETAIL_WINDOW_WIDTH <= workArea.x + workArea.width;
  const targetX = canPlaceRight ? rightX : Math.max(workArea.x, leftX);
  const targetY = Math.min(
    Math.max(workArea.y + 32, petBounds.y + 92),
    workArea.y + workArea.height - DETAIL_WINDOW_HEIGHT - 24
  );

  return {
    x: targetX,
    y: targetY,
    width: DETAIL_WINDOW_WIDTH,
    height: DETAIL_WINDOW_HEIGHT
  };
}

function enforceFocusDetailSize() {
  if (
    isFixingFocusDetailBounds ||
    !focusDetailWindow ||
    focusDetailWindow.isDestroyed()
  ) {
    return;
  }

  const currentBounds = focusDetailWindow.getBounds();
  if (
    currentBounds.width === DETAIL_WINDOW_WIDTH &&
    currentBounds.height === DETAIL_WINDOW_HEIGHT
  ) {
    return;
  }

  isFixingFocusDetailBounds = true;
  focusDetailWindow.setBounds({
    x: currentBounds.x,
    y: currentBounds.y,
    width: DETAIL_WINDOW_WIDTH,
    height: DETAIL_WINDOW_HEIGHT
  });
  isFixingFocusDetailBounds = false;
}

function beginNativePetDrag() {
  if (!petWindow || petWindow.isDestroyed() || process.platform !== "win32") {
    return false;
  }

  const nativeHandleBuffer = petWindow.getNativeWindowHandle();
  if (!nativeHandleBuffer || nativeHandleBuffer.length < 4 || !ReleaseCapture || !SendMessageW || !GetCursorPos) {
    return false;
  }

  const hwnd = nativeHandleBuffer.length >= 8
    ? nativeHandleBuffer.readBigUInt64LE(0)
    : BigInt(nativeHandleBuffer.readUInt32LE(0));
  const point = { x: 0, y: 0 };
  const gotCursor = GetCursorPos(point);
  const x = gotCursor ? point.x : 0;
  const y = gotCursor ? point.y : 0;
  const lParam = ((y & 0xffff) << 16) | (x & 0xffff);

  nativeDragState = {
    entered: false,
    exited: false
  };
  ReleaseCapture();
  try {
    SendMessageW(hwnd, WM_SYSCOMMAND, SC_MOVE | HTCAPTION, lParam);
    return nativeDragState.entered || nativeDragState.exited;
  } catch (_error) {
    try {
      nativeDragState = {
        entered: false,
        exited: false
      };
      ReleaseCapture();
      SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, lParam);
      return nativeDragState.entered || nativeDragState.exited;
    } catch (_innerError) {
      return false;
    }
  }
}

function syncFocusDetailState() {
  if (!focusDetailWindow || focusDetailWindow.isDestroyed() || !focusDetailState) {
    return;
  }

  focusDetailWindow.webContents.send("focus-detail-state", focusDetailState);
}

function closeFocusDetailWindow() {
  if (focusDetailWindow && !focusDetailWindow.isDestroyed()) {
    focusDetailWindow.close();
  }
  focusDetailWindow = null;
}

function openFocusDetailWindow(payload) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  focusDetailState = payload;
  const bounds = resolveFocusDetailBounds();

  if (!focusDetailWindow || focusDetailWindow.isDestroyed()) {
    focusDetailWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    focusDetailWindow.setMinimumSize(DETAIL_WINDOW_WIDTH, DETAIL_WINDOW_HEIGHT);
    focusDetailWindow.setMaximumSize(DETAIL_WINDOW_WIDTH, DETAIL_WINDOW_HEIGHT);
    focusDetailWindow.loadFile(path.join(__dirname, "renderer", "focus-detail.html"));
    focusDetailWindow.webContents.on("did-finish-load", syncFocusDetailState);
    focusDetailWindow.on("resize", function () {
      enforceFocusDetailSize();
    });
    focusDetailWindow.on("closed", function () {
      focusDetailWindow = null;
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send("focus-detail-action", { id: "focus-detail-closed" });
      }
    });
  } else {
    focusDetailWindow.setSize(bounds.width, bounds.height);
    focusDetailWindow.setPosition(bounds.x, bounds.y);
    syncFocusDetailState();
  }

  focusDetailWindow.show();
  return focusDetailWindow.getBounds();
}

app.whenReady().then(function () {
  if (!gotSingleInstanceLock) {
    return;
  }

  createPetWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });
});

app.on("second-instance", function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  if (petWindow.isMinimized()) {
    petWindow.restore();
  }

  petWindow.focus();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("pet:showContextMenu", function (_event, payload) {
  if (!petWindow || petWindow.isDestroyed()) {
    return false;
  }

  const items = sanitizeContextMenuItems(payload && payload.items);
  if (items.length === 0) {
    return false;
  }

  const menu = buildPetMenu(items);
  menu.popup({
    window: petWindow,
    x: isFiniteNumber(payload && payload.x) ? Math.round(payload.x) : undefined,
    y: isFiniteNumber(payload && payload.y) ? Math.round(payload.y) : undefined
  });
  return true;
});

ipcMain.on("pet:setPosition", function (_event, position) {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  if (!position || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
    return;
  }

  const currentBounds = petWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(position.x),
    y: Math.round(position.y)
  });
  const clamped = clampWindowRectToDisplay(
    {
      x: Math.round(position.x),
      y: Math.round(position.y)
    },
    display.workArea,
    currentBounds.width,
    currentBounds.height
  );

  petWindow.setPosition(
    clamped.x,
    clamped.y
  );
});

ipcMain.handle("pet:beginNativeDrag", function () {
  return beginNativePetDrag();
});

ipcMain.on("pet:setDraggingState", function (_event, payload) {
  isPetDragging = Boolean(payload && payload.dragging);
});

ipcMain.handle("pet:setExpanded", function (_event, payload) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const currentBounds = petWindow.getBounds();
  const targetHeight = payload && payload.expanded === true
    ? EXPANDED_WINDOW_HEIGHT
    : COLLAPSED_WINDOW_HEIGHT;
  const display = screen.getDisplayMatching(currentBounds);
  const clamped = clampWindowRectToDisplay(
    {
      x: currentBounds.x,
      y: currentBounds.y
    },
    display.workArea,
    WINDOW_WIDTH,
    targetHeight
  );

  petWindow.setBounds({
    x: clamped.x,
    y: clamped.y,
    width: WINDOW_WIDTH,
    height: targetHeight
  });

  return petWindow.getBounds();
});

ipcMain.handle("focus:openDetail", function (_event, payload) {
  return openFocusDetailWindow(payload);
});

ipcMain.handle("focus:updateDetail", function (_event, payload) {
  if (!payload || typeof payload !== "object") {
    return focusDetailState;
  }

  focusDetailState = payload;
  syncFocusDetailState();
  return focusDetailState;
});

ipcMain.handle("focus:closeDetail", function () {
  closeFocusDetailWindow();
  return true;
});

ipcMain.handle("focus:readSound", function () {
  return readFocusSoundDataUrl();
});

ipcMain.handle("focus:selectSound", async function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const result = await dialog.showOpenDialog(petWindow, {
    title: "选择提示音",
    properties: ["openFile"],
    filters: [
      { name: "音频文件", extensions: ["wav", "mp3", "ogg", "m4a"] }
    ]
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return null;
  }

  setCustomFocusSoundPath(result.filePaths[0]);
  return readFocusSoundDataUrl();
});


ipcMain.on("focus:detailAction", function (_event, payload) {
  if (payload && payload.id === "focus-detail-close") {
    closeFocusDetailWindow();
    return;
  }

  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("focus-detail-action", payload);
  }
});

ipcMain.handle("pet:close", function () {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close();
  }
});

ipcMain.handle("pet:getBounds", function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  return petWindow.getBounds();
});
