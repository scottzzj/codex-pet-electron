(function () {
  const listeners = {
    menuAction: [],
    focusDetailAction: [],
    focusDetailState: [],
    windowBoundsChanged: []
  };

  let bounds = {
    x: 0,
    y: 0,
    width: 356,
    height: 320
  };

  function noop() {
    return null;
  }

  function resolved(value) {
    return Promise.resolve(value);
  }

  function subscribe(bucket, handler) {
    if (typeof handler !== "function") {
      return noop;
    }

    bucket.push(handler);
    return function unsubscribe() {
      const index = bucket.indexOf(handler);
      if (index >= 0) {
        bucket.splice(index, 1);
      }
    };
  }

  function emit(bucket, payload) {
    bucket.slice().forEach(function (handler) {
      try {
        handler(payload);
      } catch (_error) {
        return null;
      }
    });
  }

  window.petBridge = {
    showContextMenu: function () {
      return resolved(false);
    },
    setPosition: function (nextPosition) {
      if (!nextPosition) {
        return null;
      }

      bounds = {
        x: typeof nextPosition.x === "number" ? nextPosition.x : bounds.x,
        y: typeof nextPosition.y === "number" ? nextPosition.y : bounds.y,
        width: bounds.width,
        height: bounds.height
      };

      emit(listeners.windowBoundsChanged, bounds);
      return null;
    },
    setDraggingState: function (payload) {
      return null;
    },
    setExpanded: function () {
      return resolved(bounds);
    },
    openFocusDetail: function () {
      return resolved(null);
    },
    updateFocusDetail: function () {
      return resolved(null);
    },
    closeFocusDetail: function () {
      return resolved(true);
    },
    selectFocusSound: function () {
      return resolved(null);
    },
    listAvailablePets: function () {
      return resolved([
        {
          key: "preview:codex-puppy",
          id: "codex-puppy",
          displayName: "Codex Puppy",
          description: "Static preview pet",
          source: "preview"
        }
      ]);
    },
    readCodexActivities: function () {
      return resolved([
        {
          id: "preview-chat-1",
          title: "添加 Codex Pet 右键操作",
          body: "这是静态预览页中的最新动态示例，用来模拟真实会话的标题与摘要展示效果。",
          source: "demo",
          state: "running",
          updatedAtMs: Date.now() - 20 * 1000
        },
        {
          id: "preview-chat-2",
          title: "TickTick 专注入口优化",
          body: "右键菜单支持开始专注、查看详情，并保持浮窗位置与主宠物解耦。",
          source: "demo",
          state: "review",
          updatedAtMs: Date.now() - 4 * 60 * 1000
        },
        {
          id: "preview-chat-3",
          title: "宠物形象 ZIP 导入",
          body: "支持直接导入宠物压缩包，并把已选形象保存到本地配置。",
          source: "demo",
          state: "idle",
          updatedAtMs: Date.now() - 18 * 60 * 1000
        }
      ]);
    },
    setSelectedPet: function () {
      return resolved({
        key: "preview:codex-puppy",
        id: "codex-puppy",
        displayName: "Puppy",
        description: "Static preview pet",
        spritesheetDataUrl: "./preview/codex-puppy.webp"
      });
    },
    importPetZip: function () {
      return resolved(null);
    },
    getBounds: function () {
      return resolved(bounds);
    },
    closeWindow: noop,
    onMenuAction: function (handler) {
      return subscribe(listeners.menuAction, handler);
    },
    onFocusDetailAction: function (handler) {
      return subscribe(listeners.focusDetailAction, handler);
    },
    onFocusDetailState: function (handler) {
      return subscribe(listeners.focusDetailState, handler);
    },
    onWindowBoundsChanged: function (handler) {
      return subscribe(listeners.windowBoundsChanged, handler);
    },
    sendFocusDetailAction: noop,
    readCodexState: function () {
      return resolved(null);
    },
    readSelectedPet: function () {
      return resolved({
        id: "codex-puppy",
        displayName: "Puppy",
        description: "Static preview pet",
        spritesheetDataUrl: "./preview/codex-puppy.webp"
      });
    },
    readFocusSound: function () {
      return resolved(null);
    }
  };
})();
