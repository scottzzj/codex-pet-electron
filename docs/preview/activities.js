(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  PetApp.createActivitiesModule = function createActivitiesModule(options) {
    const constants = options.constants;
    const elements = options.elements;
    const petState = options.petState;

    let bodyResizeObserver = null;

    function decodeDisplayText(text) {
      return String(text || "");
    }

    function normalizeStatus(state) {
      if (state === "running-left" || state === "running-right" || state === "jumping") {
        return "running";
      }
      if (state === "waving") {
        return "review";
      }
      return state;
    }

    function getPriority(state) {
      const normalized = normalizeStatus(state);
      return Object.prototype.hasOwnProperty.call(constants.priorityByState, normalized)
        ? constants.priorityByState[normalized]
        : constants.priorityByState.idle;
    }

    function getExpiryMs(state) {
      return constants.expiryMsByState[normalizeStatus(state)] || Number.POSITIVE_INFINITY;
    }

    function isExpired(activity, now) {
      return now - activity.updatedAtMs > getExpiryMs(activity.state);
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatRelativeAge(updatedAtMs) {
      const deltaMs = Math.max(0, Date.now() - updatedAtMs);
      if (deltaMs < 60000) {
        return "刚刚";
      }
      return Math.floor(deltaMs / 60000) + " 分钟前";
    }

    function computeVisibleActivities() {
      const now = Date.now();
      return petState.activities
        .filter(function (activity) {
          return !isExpired(activity, now);
        })
        .sort(function (left, right) {
          const priorityDelta = getPriority(left.state) - getPriority(right.state);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }
          return right.updatedAtMs - left.updatedAtMs;
        });
    }

    function setActivities(activities) {
      petState.activities = activities;
    }

    function renderActivities() {
      if (petState.isInteractingWithActivityList) {
        return;
      }

      if (petState.visibleActivities.length === 0) {
        if (petState.lastActivitiesMarkup !== "") {
          petState.lastActivitiesMarkup = "";
          elements.activityList.innerHTML = "";
        }
        return;
      }

      const nextMarkup = petState.visibleActivities.map(function (activity) {
        return [
          '<article class="tray-item state-', escapeHtml(normalizeStatus(activity.state)), '">',
          '<div class="tray-item-title">', escapeHtml(decodeDisplayText(activity.title)), "</div>",
          '<div class="tray-item-body" data-activity-body="', escapeHtml(activity.id), '">',
          escapeHtml(decodeDisplayText(activity.body)),
          "</div>",
          '<div class="tray-item-meta">',
          escapeHtml(decodeDisplayText(activity.source || "动态")),
          " - ",
          escapeHtml(formatRelativeAge(activity.updatedAtMs)),
          "</div>",
          "</article>"
        ].join("");
      }).join("");

      if (nextMarkup === petState.lastActivitiesMarkup) {
        return;
      }

      const previousScrollTop = elements.activityList.scrollTop;
      const wasNearTop = previousScrollTop <= constants.SCROLL_EDGE_TOLERANCE;
      petState.lastActivitiesMarkup = nextMarkup;
      elements.activityList.innerHTML = nextMarkup;
      elements.activityList.scrollTop = wasNearTop ? 0 : previousScrollTop;
    }

    function syncActivityState() {
      petState.visibleActivities = computeVisibleActivities();
      petState.baseState = petState.visibleActivities[0] ? petState.visibleActivities[0].state : "idle";
      if (!petState.drag && !petState.hovering) {
        petState.state = petState.baseState;
      }
    }

    function syncLatestBar() {
      const scrollTop = elements.activityList.scrollTop;
      const hiddenThreshold = constants.SCROLL_EDGE_TOLERANCE;
      const visibleThreshold = hiddenThreshold + 12;
      const isCurrentlyHidden = elements.latestBar.classList.contains("hidden");

      if (!petState.trayOpen) {
        elements.latestBar.classList.add("hidden");
        return;
      }

      if (isCurrentlyHidden) {
        elements.latestBar.classList.toggle("hidden", scrollTop < visibleThreshold);
        return;
      }

      elements.latestBar.classList.toggle("hidden", scrollTop <= hiddenThreshold);
    }

    function scheduleOverflowMeasurement() {
      window.requestAnimationFrame(function () {
        syncLatestBar();
      });
    }

    function ensureBodyObserver() {
      if (typeof ResizeObserver === "undefined") {
        return;
      }

      if (!bodyResizeObserver) {
        bodyResizeObserver = new ResizeObserver(scheduleOverflowMeasurement);
      } else {
        bodyResizeObserver.disconnect();
      }

      elements.activityList.querySelectorAll("[data-activity-body]").forEach(function (bodyElement) {
        bodyResizeObserver.observe(bodyElement);
      });
    }

    return {
      ensureBodyObserver: ensureBodyObserver,
      normalizeStatus: normalizeStatus,
      renderActivities: renderActivities,
      scheduleOverflowMeasurement: scheduleOverflowMeasurement,
      setActivities: setActivities,
      syncActivityState: syncActivityState,
      syncLatestBar: syncLatestBar
    };
  };
})();
