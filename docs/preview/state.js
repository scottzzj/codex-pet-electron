(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  PetApp.createElements = function createElements() {
    return {
      anchor: document.getElementById("pet-anchor"),
      pet: document.getElementById("pet"),
      sprite: document.getElementById("pet-sprite"),
      tray: document.getElementById("activity-tray"),
      activityList: document.getElementById("activity-list"),
      badge: document.getElementById("pet-badge"),
      chip: document.getElementById("status-chip"),
      trayToggle: document.getElementById("tray-toggle"),
      latestBar: document.getElementById("tray-latest-bar"),
      latestButton: document.getElementById("tray-latest-button")
    };
  };

  PetApp.createPetState = function createPetState(constants) {
    return {
      state: "running",
      baseState: "running",
      trayOpen: true,
      reducedMotion: false,
      drag: null,
      hovering: false,
      activities: [],
      visibleActivities: [],
      lastActivitiesMarkup: "",
      animationTimer: null,
      hoverTimer: null,
      refreshTimer: null,
      focusSoundDataUrl: null,
      focusDetailOpen: false,
      lastAnimationKey: "",
      selectedPet: null,
      windowBounds: null,
      focus: {
        status: "idle",
        startedAtMs: null,
        pauseStartedAtMs: null,
        pausedAccumulatedMs: 0,
        pauseCount: 0,
        durationMs: 25 * 60 * 1000,
        completedAtMs: null
      },
      constants: constants
    };
  };
})();
