(function () {
  const listeners = {
    menuAction: [],
    focusDetailAction: [],
    focusDetailState: [],
    windowBoundsChanged: [],
    nativeDragState: []
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
      emit(listeners.nativeDragState, payload);
      return null;
    },
    beginNativeDrag: function () {
      return resolved(false);
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
    onNativeDragState: function (handler) {
      return subscribe(listeners.nativeDragState, handler);
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
