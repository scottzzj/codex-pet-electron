(function () {
  const constants = window.PetApp.constants;
  const elements = window.PetApp.createElements();
  const petBridge = window.petBridge;
  const petState = window.PetApp.createPetState(constants);

  const animationModule = window.PetApp.createAnimationModule({
    constants: constants,
    elements: elements,
    petState: petState
  });

  const activityModule = window.PetApp.createActivitiesModule({
    constants: constants,
    elements: elements,
    petState: petState
  });

  const focusModule = window.PetApp.createFocusModule({
    constants: constants,
    petBridge: petBridge,
    petState: petState,
    onStateChanged: handleFocusStateChanged
  });

  const menuModule = window.PetApp.createMenuModule({
    constants: constants,
    petBridge: petBridge,
    petState: petState,
    onClosePet: function () {
      petBridge.closeWindow();
    },
    onOpenFocusDetail: function () {
      focusModule.openFocusDetail();
    },
    onStartFocus: function (minutes) {
      focusModule.startFocus(minutes);
      focusModule.openFocusDetail();
    },
    onToggleTray: toggleTray
  });

  const interactionModule = window.PetApp.createInteractionModule({
    constants: constants,
    elements: elements,
    petBridge: petBridge,
    petState: petState,
    render: render,
    showMenu: menuModule.showMenu,
    syncLatestBar: activityModule.syncLatestBar,
    toggleTray: toggleTray
  });

  function rebuildActivities() {
    const activities = [];
    const focusActivity = focusModule.getFocusActivity();

    if (focusActivity) {
      activities.push(focusActivity);
    }

    activities.push({
      id: constants.baseActivity.id,
      title: constants.baseActivity.title,
      body: constants.baseActivity.body,
      source: constants.baseActivity.source,
      state: focusActivity ? "idle" : constants.baseActivity.state,
      updatedAtMs: Date.now()
    });

    activityModule.setActivities(activities);
  }

  function handleFocusStateChanged() {
    rebuildActivities();
    render();
  }

  function render() {
    activityModule.syncActivityState();

    const badgeTheme = constants.badgeThemeByState[petState.state] || constants.badgeThemeByState.idle;
    activityModule.renderActivities();

    elements.tray.classList.toggle("hidden", !petState.trayOpen);
    elements.badge.textContent = String(Math.max(1, petState.visibleActivities.length));
    elements.badge.style.background = badgeTheme.bg;
    elements.badge.style.color = badgeTheme.fg;
    elements.chip.textContent = petState.focus.status === "idle"
      ? (constants.statusCopy[petState.state] || "Waiting")
      : focusModule.getFocusStatusText();
    elements.chip.className = "avatar-status-chip status-" + activityModule.normalizeStatus(petState.state);
    elements.trayToggle.textContent = petState.trayOpen ? "-" : "+";

    if (petState.selectedPet && petState.selectedPet.spritesheetDataUrl) {
      elements.sprite.style.backgroundImage = "url(" + petState.selectedPet.spritesheetDataUrl + ")";
    }

    activityModule.ensureBodyObserver();
    activityModule.scheduleOverflowMeasurement();
    animationModule.playAnimation();
  }

  function applyCodexStateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }

    const overlayOpen = snapshot["electron-avatar-overlay-open"];
    if (typeof overlayOpen === "boolean") {
      petState.trayOpen = overlayOpen;
    }

    const overlayBounds = snapshot["electron-avatar-overlay-bounds"];
    if (overlayBounds && typeof overlayBounds === "object") {
      if (typeof overlayBounds.x === "number" && typeof overlayBounds.y === "number") {
        petState.windowBounds = {
          x: overlayBounds.x,
          y: overlayBounds.y,
          width: overlayBounds.width || constants.WINDOW_WIDTH,
          height: overlayBounds.height || constants.WINDOW_HEIGHT
        };
      }

      if (overlayBounds.mascot) {
        const mascotLeft = typeof overlayBounds.mascot.left === "number"
          ? overlayBounds.mascot.left
          : constants.DEFAULT_LAYOUT.mascot.left;
        const mascotTop = typeof overlayBounds.mascot.top === "number"
          ? overlayBounds.mascot.top
          : constants.DEFAULT_LAYOUT.mascot.top;
        elements.anchor.style.left = Math.round(mascotLeft) + "px";
        elements.anchor.style.top = Math.round(mascotTop) + "px";
      }
      if (overlayBounds.tray) {
        const trayLeft = typeof overlayBounds.tray.left === "number"
          ? overlayBounds.tray.left
          : constants.DEFAULT_LAYOUT.tray.left;
        const trayTop = typeof overlayBounds.tray.top === "number"
          ? overlayBounds.tray.top
          : constants.DEFAULT_LAYOUT.tray.top;
        elements.tray.style.left = Math.round(trayLeft) + "px";
        elements.tray.style.top = Math.round(trayTop) + "px";
      }
    }
  }

  function toggleTray() {
    petState.trayOpen = !petState.trayOpen;
    Promise.resolve(petBridge.setExpanded(petState.trayOpen)).then(function (bounds) {
      if (bounds) {
        petState.windowBounds = bounds;
      }
      return bounds;
    }).catch(function () {
      return null;
    });
    render();
  }

  function scheduleRefresh() {
    window.clearInterval(petState.refreshTimer);
    petState.refreshTimer = window.setInterval(function () {
      if (petState.focus.status === "running") {
        focusModule.updateFocusState();
      }
    }, constants.REFRESH_INTERVAL_MS);
  }

  interactionModule.bindEvents();

  petBridge.onMenuAction(function (payload) {
    menuModule.handleMenuAction(payload);
  });

  petBridge.onFocusDetailAction(function (payload) {
    focusModule.handleDetailAction(payload);
  });

  petBridge.onWindowBoundsChanged(function (bounds) {
    if (bounds) {
      petState.windowBounds = bounds;
    }
  });

  rebuildActivities();
  render();
  scheduleRefresh();

  Promise.resolve(petBridge.readCodexState()).then(function (snapshot) {
    applyCodexStateSnapshot(snapshot);
    rebuildActivities();
    render();
    return petBridge.setExpanded(petState.trayOpen);
  }).then(function (bounds) {
    if (bounds) {
      petState.windowBounds = bounds;
    }
  });

  Promise.resolve(petBridge.getBounds()).then(function (bounds) {
    if (bounds) {
      petState.windowBounds = bounds;
    }
  }).catch(function () {
    return null;
  });

  Promise.resolve(petBridge.readSelectedPet()).then(function (pet) {
    if (!pet) {
      return;
    }
    petState.selectedPet = pet;
    render();
  });

  Promise.resolve(petBridge.readFocusSound()).then(function (soundDataUrl) {
    focusModule.setFocusSoundDataUrl(soundDataUrl);
  });

})();
