(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  PetApp.createFocusModule = function createFocusModule(options) {
    const constants = options.constants;
    const petBridge = options.petBridge;
    const petState = options.petState;
    const onStateChanged = options.onStateChanged;

    function createIdleFocusState() {
      return {
        status: "idle",
        startedAtMs: null,
        pauseStartedAtMs: null,
        pausedAccumulatedMs: 0,
        pauseCount: 0,
        durationMs: 25 * 60 * 1000,
        completedAtMs: null
      };
    }

    function formatDuration(msRemaining) {
      const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function getFocusElapsedMs(now) {
      if (!petState.focus.startedAtMs) {
        return 0;
      }

      const activeNow = petState.focus.status === "running"
        ? now
        : petState.focus.pauseStartedAtMs || now;

      return Math.max(0, activeNow - petState.focus.startedAtMs - petState.focus.pausedAccumulatedMs);
    }

    function getFocusRemainingMs(now) {
      return Math.max(0, petState.focus.durationMs - getFocusElapsedMs(now));
    }

    function getFocusStatusText() {
      if (petState.focus.status === "running") {
        return "专注中";
      }
      if (petState.focus.status === "paused") {
        return "已暂停";
      }
      if (petState.focus.status === "completed") {
        return "已完成";
      }
      return "等待中";
    }

    function getFocusActivity() {
      const now = Date.now();
      const remainingText = formatDuration(getFocusRemainingMs(now));

      if (petState.focus.status === "idle") {
        return null;
      }

      if (petState.focus.status === "completed") {
        return {
          id: "focus-session",
          title: "专注已完成",
          body: "本轮专注已经结束，可以打开详情再次开始，或者直接结束本次专注。",
          source: "专注计时",
          state: "review",
          updatedAtMs: petState.focus.completedAtMs || now
        };
      }

      return {
        id: "focus-session",
        title: petState.focus.status === "paused" ? "专注已暂停" : "专注进行中",
        body: "剩余 " + remainingText + "，已暂停 " + petState.focus.pauseCount + "/" + constants.FOCUS_MAX_PAUSES + " 次。",
        source: "专注计时",
        state: petState.focus.status === "paused" ? "waiting" : "running",
        updatedAtMs: now
      };
    }

    function buildFocusDetailPayload() {
      return {
        title: "专注计时",
        timerText: formatDuration(getFocusRemainingMs(Date.now())),
        status: petState.focus.status,
        statusText: petState.focus.status === "idle"
          ? "未开始"
          : (petState.focus.status === "running"
            ? "专注中"
            : (petState.focus.status === "paused" ? "已暂停" : "已完成")),
        durationMinutes: Math.round(petState.focus.durationMs / 60000),
        pauseCount: petState.focus.pauseCount,
        maxPauses: constants.FOCUS_MAX_PAUSES,
        canPause: petState.focus.pauseCount < constants.FOCUS_MAX_PAUSES
      };
    }

    function syncFocusDetailWindow() {
      if (!petState.focusDetailOpen) {
        return;
      }
      Promise.resolve(petBridge.updateFocusDetail(buildFocusDetailPayload())).catch(function () {
        return null;
      });
    }

    function playFocusSound() {
      if (!petState.focusSoundDataUrl) {
        try {
          const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextCtor) {
            return;
          }

          const audioContext = new AudioContextCtor();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.48);
          oscillator.onended = function () {
            audioContext.close().catch(function () {
              return null;
            });
          };
        } catch (_error) {
          return;
        }
        return;
      }
      const audio = new Audio(petState.focusSoundDataUrl);
      audio.play().catch(function () {
        return null;
      });
    }

    function notifyStateChanged() {
      onStateChanged();
      syncFocusDetailWindow();
    }

    function completeFocus() {
      petState.focus.status = "completed";
      petState.focus.completedAtMs = Date.now();
      playFocusSound();
      notifyStateChanged();
    }

    function updateFocusState() {
      if (petState.focus.status !== "running") {
        return;
      }

      if (getFocusRemainingMs(Date.now()) <= 0) {
        completeFocus();
        return;
      }

      notifyStateChanged();
    }

    function startFocus(durationMinutes) {
      petState.focus = {
        status: "running",
        startedAtMs: Date.now(),
        pauseStartedAtMs: null,
        pausedAccumulatedMs: 0,
        pauseCount: 0,
        durationMs: durationMinutes * 60 * 1000,
        completedAtMs: null
      };
      notifyStateChanged();
    }

    function pauseFocus() {
      if (petState.focus.status !== "running" || petState.focus.pauseCount >= constants.FOCUS_MAX_PAUSES) {
        return;
      }
      petState.focus.status = "paused";
      petState.focus.pauseStartedAtMs = Date.now();
      petState.focus.pauseCount += 1;
      notifyStateChanged();
    }

    function resumeFocus() {
      if (petState.focus.status !== "paused") {
        return;
      }
      petState.focus.pausedAccumulatedMs += Date.now() - petState.focus.pauseStartedAtMs;
      petState.focus.pauseStartedAtMs = null;
      petState.focus.status = "running";
      notifyStateChanged();
    }

    function stopFocus() {
      petState.focus = createIdleFocusState();
      onStateChanged();
      if (petState.focusDetailOpen) {
        Promise.resolve(petBridge.closeFocusDetail()).catch(function () {
          return null;
        });
        petState.focusDetailOpen = false;
      }
    }

    function openFocusDetail() {
      petState.focusDetailOpen = true;
      Promise.resolve(petBridge.openFocusDetail(buildFocusDetailPayload())).catch(function () {
        petState.focusDetailOpen = false;
        return null;
      });
    }

    function handleDetailAction(payload) {
      if (!payload || !payload.id) {
        return;
      }

      if (payload.id === "focus-pause") {
        pauseFocus();
      } else if (payload.id === "focus-resume") {
        resumeFocus();
      } else if (payload.id === "focus-stop") {
        stopFocus();
      } else if (payload.id === "focus-detail-close" || payload.id === "focus-detail-closed") {
        petState.focusDetailOpen = false;
      }
    }

    function setFocusSoundDataUrl(soundDataUrl) {
      petState.focusSoundDataUrl = soundDataUrl;
    }

    return {
      getFocusActivity: getFocusActivity,
      getFocusStatusText: getFocusStatusText,
      handleDetailAction: handleDetailAction,
      openFocusDetail: openFocusDetail,
      setFocusSoundDataUrl: setFocusSoundDataUrl,
      startFocus: startFocus,
      updateFocusState: updateFocusState
    };
  };
})();
