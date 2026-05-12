(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  PetApp.createAnimationModule = function createAnimationModule(options) {
    const constants = options.constants;
    const elements = options.elements;
    const petState = options.petState;

    function backgroundPosition(frame) {
      return (
        (frame.columnIndex / (constants.COLS - 1)) * 100 + "% " +
        (frame.rowIndex / (constants.ROWS - 1)) * 100 + "%"
      );
    }

    function buildAnimation(state, prefersReducedMotion) {
      const frames = constants.stateFrames[state] || constants.stateFrames.idle;
      if (prefersReducedMotion) {
        return { frames: [frames[0]], loopStartIndex: null };
      }

      if (state === "idle") {
        return {
          frames: constants.stateFrames.idle.map(function (frame) {
            return {
              rowIndex: frame.rowIndex,
              columnIndex: frame.columnIndex,
              frameDurationMs: frame.frameDurationMs * constants.IDLE_MULTIPLIER
            };
          }),
          loopStartIndex: 0
        };
      }

      const repeated = frames.concat(frames, frames);
      return {
        frames: repeated.concat(
          constants.stateFrames.idle.map(function (frame) {
            return {
              rowIndex: frame.rowIndex,
              columnIndex: frame.columnIndex,
              frameDurationMs: frame.frameDurationMs * constants.IDLE_MULTIPLIER
            };
          })
        ),
        loopStartIndex: repeated.length
      };
    }

    function stopAnimation() {
      if (petState.animationTimer !== null) {
        window.clearTimeout(petState.animationTimer);
        petState.animationTimer = null;
      }
    }

    function playAnimation() {
      const animationKey = petState.state + ":" + String(petState.reducedMotion);
      if (animationKey === petState.lastAnimationKey) {
        return;
      }

      petState.lastAnimationKey = animationKey;
      stopAnimation();

      const animation = buildAnimation(petState.state, petState.reducedMotion);
      const frames = animation.frames;
      let index = 0;

      if (!frames.length) {
        return;
      }

      elements.sprite.style.backgroundPosition = backgroundPosition(frames[0]);
      if (frames.length === 1) {
        return;
      }

      function advance() {
        petState.animationTimer = window.setTimeout(function () {
          const nextIndex = index + 1;
          if (nextIndex >= frames.length) {
            if (animation.loopStartIndex == null) {
              petState.animationTimer = null;
              return;
            }
            index = animation.loopStartIndex;
          } else {
            index = nextIndex;
          }

          elements.sprite.style.backgroundPosition = backgroundPosition(frames[index]);
          advance();
        }, frames[index].frameDurationMs);
      }

      advance();
    }

    return {
      playAnimation: playAnimation,
      stopAnimation: stopAnimation
    };
  };
})();
