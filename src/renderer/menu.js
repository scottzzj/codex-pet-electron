(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  PetApp.createMenuModule = function createMenuModule(options) {
    const constants = options.constants;
    const petBridge = options.petBridge;
    const petState = options.petState;
    const onClosePet = options.onClosePet;
    const onChangeFocusSound = options.onChangeFocusSound;
    const onOpenFocusDetail = options.onOpenFocusDetail;
    const onStartFocus = options.onStartFocus;
    const onToggleTray = options.onToggleTray;

    function formatMinutesLabel(minutes) {
      return String(minutes) + " 分钟";
    }

    function buildMenuItems() {
      const items = [];

      if (petState.focus.status === "idle" || petState.focus.status === "completed") {
        items.push({
          id: "focus-start-root",
          label: "开始专注",
          submenu: constants.FOCUS_PRESETS.map(function (minutes) {
            return { id: "focus-start-" + String(minutes), label: formatMinutesLabel(minutes) };
          })
        });
      } else {
        items.push({ id: "focus-detail-open", label: "专注详情" });
      }

      items.push({ type: "separator" });
      items.push({
        id: "focus-sound-root",
        label: "提示音",
        submenu: [
          { id: "focus-sound-change", label: "修改提示音" }
        ]
      });
      items.push({ type: "separator" });
      items.push({ id: "toggle-tray", label: petState.trayOpen ? "收起动态" : "打开动态" });
      items.push({ id: "close-pet", label: "关闭宠物" });

      return items;
    }

    function showMenu(event) {
      event.preventDefault();
      petBridge.showContextMenu({
        x: Math.round(event.x),
        y: Math.round(event.y),
        items: buildMenuItems()
      });
    }

    function handleMenuAction(payload) {
      if (!payload || !payload.id) {
        return;
      }

      if (payload.id === "toggle-tray") {
        onToggleTray();
      } else if (payload.id.indexOf("focus-start-") === 0) {
        onStartFocus(Number(payload.id.replace("focus-start-", "")));
      } else if (payload.id === "focus-detail-open") {
        onOpenFocusDetail();
      } else if (payload.id === "focus-sound-change") {
        onChangeFocusSound();
      } else if (payload.id === "close-pet") {
        onClosePet();
      }
    }

    return {
      handleMenuAction: handleMenuAction,
      showMenu: showMenu
    };
  };
})();
