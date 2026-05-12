const { contextBridge, ipcRenderer } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const fsp = fs.promises;

async function readCodexGlobalState() {
  try {
    const statePath = path.join(os.homedir(), ".codex", ".codex-global-state.json");
    const raw = await fsp.readFile(statePath, "utf8");
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function resolvePathInsideRoot(rootDir, targetPath) {
  const rootRealPath = await fsp.realpath(rootDir);
  const targetRealPath = await fsp.realpath(targetPath);
  const relativePath = path.relative(rootRealPath, targetRealPath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return targetRealPath;
}

async function readSelectedPet() {
  try {
    const globalState = await readCodexGlobalState();
    const selectedAvatarId = globalState?.["electron-persisted-atom-state"]?.["selected-avatar-id"];
    if (!selectedAvatarId || !selectedAvatarId.startsWith("custom:")) {
      return null;
    }

    const petId = selectedAvatarId.slice("custom:".length);
    const petsRootDir = path.join(os.homedir(), ".codex", "pets");
    const unresolvedPetDir = path.resolve(petsRootDir, petId);
    const petDir = await resolvePathInsideRoot(petsRootDir, unresolvedPetDir);
    if (!petDir) {
      return null;
    }

    const petJsonPath = await resolvePathInsideRoot(petDir, path.join(petDir, "pet.json"));
    if (!petJsonPath) {
      return null;
    }

    const petJson = JSON.parse(await fsp.readFile(petJsonPath, "utf8"));
    const spriteFileName = typeof petJson.spritesheetPath === "string"
      ? petJson.spritesheetPath
      : "spritesheet.webp";
    const spritePath = await resolvePathInsideRoot(petDir, path.resolve(petDir, spriteFileName));
    if (!spritePath) {
      return null;
    }

    const spriteBuffer = await fsp.readFile(spritePath);
    const spriteExt = path.extname(spritePath).slice(1) || "webp";

    return {
      id: petJson.id,
      displayName: petJson.displayName,
      description: petJson.description,
      spritesheetDataUrl: "data:image/" + spriteExt + ";base64," + spriteBuffer.toString("base64")
    };
  } catch (_error) {
    return null;
  }
}

async function readFocusSound() {
  try {
    const preferredPath = "D:\\TickTick\\pomo.wav";
    const soundBuffer = await fsp.readFile(preferredPath);
    return "data:audio/wav;base64," + soundBuffer.toString("base64");
  } catch (_error) {
    return null;
  }
}

contextBridge.exposeInMainWorld("petBridge", {
  showContextMenu: function (payload) {
    return ipcRenderer.invoke("pet:showContextMenu", payload);
  },
  setBounds: function (bounds) {
    ipcRenderer.send("pet:setBounds", bounds);
  },
  setPosition: function (position) {
    ipcRenderer.send("pet:setPosition", position);
  },
  beginNativeDrag: function () {
    return ipcRenderer.invoke("pet:beginNativeDrag");
  },
  setExpanded: function (expanded) {
    return ipcRenderer.invoke("pet:setExpanded", { expanded: expanded });
  },
  openFocusDetail: function (payload) {
    return ipcRenderer.invoke("focus:openDetail", payload);
  },
  updateFocusDetail: function (payload) {
    return ipcRenderer.invoke("focus:updateDetail", payload);
  },
  closeFocusDetail: function () {
    return ipcRenderer.invoke("focus:closeDetail");
  },
  getBounds: function () {
    return ipcRenderer.invoke("pet:getBounds");
  },
  closeWindow: function () {
    return ipcRenderer.invoke("pet:close");
  },
  onMenuAction: function (handler) {
    const listener = function (_event, payload) {
      handler(payload);
    };

    ipcRenderer.on("pet-menu-action", listener);
    return function () {
      ipcRenderer.removeListener("pet-menu-action", listener);
    };
  },
  onFocusDetailAction: function (handler) {
    const listener = function (_event, payload) {
      handler(payload);
    };

    ipcRenderer.on("focus-detail-action", listener);
    return function () {
      ipcRenderer.removeListener("focus-detail-action", listener);
    };
  },
  onFocusDetailState: function (handler) {
    const listener = function (_event, payload) {
      handler(payload);
    };

    ipcRenderer.on("focus-detail-state", listener);
    return function () {
      ipcRenderer.removeListener("focus-detail-state", listener);
    };
  },
  onWindowBoundsChanged: function (handler) {
    const listener = function (_event, payload) {
      handler(payload);
    };

    ipcRenderer.on("pet-window-bounds-changed", listener);
    return function () {
      ipcRenderer.removeListener("pet-window-bounds-changed", listener);
    };
  },
  onNativeDragState: function (handler) {
    const listener = function (_event, payload) {
      handler(payload);
    };

    ipcRenderer.on("pet-native-drag-state", listener);
    return function () {
      ipcRenderer.removeListener("pet-native-drag-state", listener);
    };
  },
  sendFocusDetailAction: function (payload) {
    ipcRenderer.send("focus:detailAction", payload);
  },
  readCodexState: function () {
    return readCodexGlobalState();
  },
  readSelectedPet: function () {
    return readSelectedPet();
  },
  readFocusSound: function () {
    return readFocusSound();
  }
});
