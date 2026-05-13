(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  PetApp.createInteractionModule = function createInteractionModule(options) {
    const constants = options.constants;
    const elements = options.elements;
    const petBridge = options.petBridge;
    const petState = options.petState;
    const render = options.render;
    const showMenu = options.showMenu;
    const toggleTray = options.toggleTray;

    let scrollSyncFrame = null;
    let dragFrame = null;

    function armDrag(event, bounds) {
      if (!bounds) {
        return;
      }

      window.clearTimeout(petState.hoverTimer);
      petState.drag = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWindowX: bounds.x,
        startWindowY: bounds.y
      };

      petState.state = "jumping";
      petState.lastAnimationKey = "";
      petState.windowBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      };
      petBridge.setDraggingState({ dragging: true });
      elements.pet.setPointerCapture(event.pointerId);
      render();
    }

    async function beginDrag(event) {
      if (event.button !== 0) {
        return;
      }

      const cachedBounds = petState.windowBounds;
      if (!event.altKey) {
        window.clearTimeout(petState.hoverTimer);
        petState.state = "jumping";
        petState.lastAnimationKey = "";
        render();
        const nativeStarted = await petBridge.beginNativeDrag().catch(function () {
          return false;
        });
        if (nativeStarted) {
          return;
        }
      }

      if (event.buttons !== 1) {
        return;
      }

      if (cachedBounds) {
        armDrag(event, cachedBounds);
        return;
      }

      const bounds = await petBridge.getBounds();
      if (event.buttons !== 1) {
        return;
      }
      armDrag(event, bounds);
    }

    function moveDrag(event) {
      if (!petState.drag || petState.drag.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - petState.drag.startClientX;
      const deltaY = event.clientY - petState.drag.startClientY;
      let nextState = petState.state;

      if (Math.abs(deltaX) >= constants.DRAG_THRESHOLD) {
        nextState = deltaX > 0 ? "running-right" : "running-left";
      } else {
        nextState = "jumping";
      }

      if (nextState !== petState.state) {
        petState.state = nextState;
        petState.lastAnimationKey = "";
        render();
      }

      petState.windowBounds = {
        x: petState.drag.startWindowX + deltaX,
        y: petState.drag.startWindowY + deltaY,
        width: constants.WINDOW_WIDTH,
        height: constants.WINDOW_HEIGHT
      };

      if (dragFrame !== null) {
        return;
      }

      dragFrame = window.requestAnimationFrame(function () {
        dragFrame = null;
        petBridge.setPosition({
          x: petState.windowBounds.x,
          y: petState.windowBounds.y
        });
      });
    }

    function endDrag(event) {
      if (!petState.drag || petState.drag.pointerId !== event.pointerId) {
        return;
      }
      if (dragFrame !== null) {
        window.cancelAnimationFrame(dragFrame);
        dragFrame = null;
      }
      petBridge.setPosition({
        x: petState.windowBounds.x,
        y: petState.windowBounds.y
      });
      petBridge.setDraggingState({ dragging: false });
      petState.drag = null;
      if (elements.pet.hasPointerCapture(event.pointerId)) {
        elements.pet.releasePointerCapture(event.pointerId);
      }
      render();
    }

    function handlePointerEnter() {
      elements.pet.classList.add("hovering");
      petState.hovering = true;
      if (petState.drag) {
        return;
      }
      window.clearTimeout(petState.hoverTimer);
      petState.hoverTimer = window.setTimeout(function () {
        if (petState.drag) {
          return;
        }
        petState.state = "waving";
        petState.lastAnimationKey = "";
        render();
      }, 260);
    }

    function handlePointerLeave() {
      elements.pet.classList.remove("hovering");
      petState.hovering = false;
      window.clearTimeout(petState.hoverTimer);
      if (!petState.drag) {
        render();
      }
    }

    function scrollToLatest() {
      elements.activityList.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleActivityListScroll() {
      if (scrollSyncFrame !== null) {
        window.cancelAnimationFrame(scrollSyncFrame);
      }
      scrollSyncFrame = window.requestAnimationFrame(function () {
        options.syncLatestBar();
        scrollSyncFrame = null;
      });
    }

    function bindEvents() {
      elements.badge.addEventListener("click", toggleTray);
      elements.trayToggle.addEventListener("click", toggleTray);
      elements.latestButton.addEventListener("click", scrollToLatest);
      elements.activityList.addEventListener("scroll", handleActivityListScroll);
      elements.pet.addEventListener("contextmenu", showMenu);
      elements.pet.addEventListener("pointerdown", beginDrag);
      elements.pet.addEventListener("pointermove", moveDrag);
      elements.pet.addEventListener("pointerup", endDrag);
      elements.pet.addEventListener("pointercancel", endDrag);
      elements.pet.addEventListener("pointerenter", handlePointerEnter);
      elements.pet.addEventListener("pointerleave", handlePointerLeave);
    }

    return {
      bindEvents: bindEvents
    };
  };
})();
