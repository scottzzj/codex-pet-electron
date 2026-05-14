(function () {
  const constants = window.PetApp.constants;
  const elements = window.PetApp.createElements();
  const petBridge = window.petBridge;
  const petState = window.PetApp.createPetState(constants);

  petState.trayOpen = false;
  petState.state = "idle";
  petState.baseState = "idle";

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
      return null;
    },
    onChangeFocusSound: function () {
      return null;
    },
    onOpenFocusDetail: function () {
      return null;
    },
    onImportPet: function () {
      return null;
    },
    onSelectPet: function (key) {
      Promise.resolve(petBridge.setSelectedPet(key)).then(function (pet) {
        if (!pet) {
          return;
        }
        petState.selectedPet = pet;
        render();
      }).catch(function () {
        return null;
      });
    },
    onStartFocus: function () {
      return null;
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

  const reducedMotionQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  function mergeActivities() {
    const activities = [];
    const focusActivity = focusModule.getFocusActivity();

    if (focusActivity) {
      activities.push(focusActivity);
    }

    Array.prototype.push.apply(activities, petState.codexActivities || []);
    activityModule.setActivities(activities);
  }

  function applyReducedMotionPreference(prefersReducedMotion) {
    if (petState.reducedMotion === prefersReducedMotion) {
      return;
    }

    petState.reducedMotion = prefersReducedMotion;
    petState.lastAnimationKey = "";
    render();
  }

  function rebuildActivities() {
    mergeActivities();
  }

  function handleFocusStateChanged() {
    rebuildActivities();
    render();
  }

  function render() {
    activityModule.syncActivityState();

    const badgeTheme = constants.badgeThemeByState[petState.state] || constants.badgeThemeByState.idle;
    activityModule.renderActivities();
    const currentChatActivity = (petState.codexActivities || []).find(function (activity) {
      return activity && typeof activity.title === "string" && activity.title.trim().length > 0;
    });
    const chipText = currentChatActivity
      ? currentChatActivity.title
      : (petState.focus.status === "idle"
        ? (constants.statusCopy[petState.state] || "Waiting")
        : focusModule.getFocusStatusText());

    elements.tray.classList.toggle("hidden", !petState.trayOpen);
    elements.badge.textContent = String(Math.max(1, petState.visibleActivities.length));
    elements.badge.style.background = badgeTheme.bg;
    elements.badge.style.color = badgeTheme.fg;
    elements.chip.textContent = chipText;
    elements.chip.title = chipText;
    elements.chip.className = "avatar-status-chip status-" + activityModule.normalizeStatus(petState.state);
    elements.trayToggle.textContent = petState.trayOpen ? "-" : "+";

    if (petState.selectedPet && petState.selectedPet.spritesheetDataUrl) {
      elements.sprite.style.backgroundImage = "url(" + petState.selectedPet.spritesheetDataUrl + ")";
    }

    activityModule.ensureBodyObserver();
    activityModule.scheduleOverflowMeasurement();
    animationModule.playAnimation();
  }

  function toggleTray() {
    petState.trayOpen = !petState.trayOpen;
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

  petBridge.onWindowBoundsChanged(function (bounds) {
    if (!bounds) {
      return;
    }

    petState.windowBounds = bounds;
    elements.anchor.style.left = Math.round(constants.DEFAULT_LAYOUT.mascot.left + bounds.x) + "px";
    elements.anchor.style.top = Math.round(constants.DEFAULT_LAYOUT.mascot.top + bounds.y) + "px";
    elements.tray.style.left = Math.round(constants.DEFAULT_LAYOUT.tray.left + bounds.x) + "px";
    elements.tray.style.top = Math.round(constants.DEFAULT_LAYOUT.tray.top + bounds.y) + "px";
  });

  if (reducedMotionQuery) {
    petState.reducedMotion = reducedMotionQuery.matches;
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", function (event) {
        applyReducedMotionPreference(event.matches);
      });
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(function (event) {
        applyReducedMotionPreference(event.matches);
      });
    }
  }

  rebuildActivities();
  render();
  scheduleRefresh();

  Promise.resolve(petBridge.listAvailablePets()).then(function (pets) {
    petState.availablePets = Array.isArray(pets) ? pets : [];
    render();
  }).catch(function () {
    return null;
  });

  Promise.resolve(petBridge.readCodexActivities()).then(function (activities) {
    petState.codexActivities = Array.isArray(activities) ? activities : [];
    rebuildActivities();
    render();
  }).catch(function () {
    return null;
  });

  Promise.resolve(petBridge.readSelectedPet()).then(function (pet) {
    if (!pet) {
      return;
    }
    petState.selectedPet = pet;
    render();
  }).catch(function () {
    return null;
  });
})();
