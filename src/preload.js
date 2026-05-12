const { contextBridge, ipcRenderer } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function readCodexGlobalState() {
  try {
    const statePath = path.join(os.homedir(), ".codex", ".codex-global-state.json");
    const raw = fs.readFileSync(statePath, "utf8");
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function readSelectedPet() {
  try {
    const globalState = readCodexGlobalState();
    const selectedAvatarId = globalState?.["electron-persisted-atom-state"]?.["selected-avatar-id"];
    if (!selectedAvatarId || !selectedAvatarId.startsWith("custom:")) {
      return null;
    }

    const petId = selectedAvatarId.slice("custom:".length);
    const petDir = path.join(os.homedir(), ".codex", "pets", petId);
    const petJsonPath = path.join(petDir, "pet.json");
    const petJson = JSON.parse(fs.readFileSync(petJsonPath, "utf8"));
    const spritePath = path.join(petDir, petJson.spritesheetPath || "spritesheet.webp");
    const spriteBuffer = fs.readFileSync(spritePath);
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

function readFocusSound() {
  try {
    const preferredPath = "D:\\TickTick\\pomo.wav";
    const soundBuffer = fs.readFileSync(preferredPath);
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
