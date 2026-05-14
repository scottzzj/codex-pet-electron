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

contextBridge.exposeInMainWorld("petBridge", {
  showContextMenu: function (payload) {
    return ipcRenderer.invoke("pet:showContextMenu", payload);
  },
  setPosition: function (position) {
    ipcRenderer.send("pet:setPosition", position);
  },
  setDraggingState: function (payload) {
    ipcRenderer.send("pet:setDraggingState", payload);
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
  selectFocusSound: function () {
    return ipcRenderer.invoke("focus:selectSound");
  },
  listAvailablePets: function () {
    return ipcRenderer.invoke("pet:listAvailable");
  },
  readCodexActivities: function () {
    return ipcRenderer.invoke("pet:readCodexActivities");
  },
  readSelectedPet: function () {
    return ipcRenderer.invoke("pet:readSelected");
  },
  setSelectedPet: function (key) {
    return ipcRenderer.invoke("pet:setSelected", { key: key });
  },
  importPetZip: function () {
    return ipcRenderer.invoke("pet:importZip");
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
  readFocusSound: function () {
    return ipcRenderer.invoke("focus:readSound");
  }
});
