(function () {
  const PetApp = window.PetApp = window.PetApp || {};

  function makeRow(rowIndex, count, frameDurationMs, lastDurationMs) {
    return Array.from({ length: count }, function (_, columnIndex) {
      return {
        rowIndex: rowIndex,
        columnIndex: columnIndex,
        frameDurationMs: columnIndex === count - 1 ? lastDurationMs : frameDurationMs
      };
    });
  }

  PetApp.constants = {
    COLS: 8,
    ROWS: 9,
    IDLE_MULTIPLIER: 6,
    DRAG_THRESHOLD: 8,
    WINDOW_WIDTH: 356,
    WINDOW_HEIGHT: 320,
    REFRESH_INTERVAL_MS: 1000,
    CODEX_ACTIVITIES_REFRESH_INTERVAL_MS: 5000,
    SCROLL_EDGE_TOLERANCE: 2,
    FOCUS_MAX_PAUSES: 3,
    FOCUS_PRESETS: [5, 10, 30, 45, 60],
    DEFAULT_LAYOUT: {
      mascot: { left: 244, top: 191 },
      tray: { left: 80, top: 56 }
    },
    stateFrames: {
      idle: [
        { rowIndex: 0, columnIndex: 0, frameDurationMs: 280 },
        { rowIndex: 0, columnIndex: 1, frameDurationMs: 110 },
        { rowIndex: 0, columnIndex: 2, frameDurationMs: 110 },
        { rowIndex: 0, columnIndex: 3, frameDurationMs: 140 },
        { rowIndex: 0, columnIndex: 4, frameDurationMs: 140 },
        { rowIndex: 0, columnIndex: 5, frameDurationMs: 320 }
      ],
      "running-right": makeRow(1, 8, 120, 220),
      "running-left": makeRow(2, 8, 120, 220),
      waving: makeRow(3, 4, 140, 280),
      jumping: makeRow(4, 5, 140, 280),
      failed: makeRow(5, 8, 140, 240),
      waiting: makeRow(6, 6, 150, 260),
      running: makeRow(7, 6, 120, 220),
      review: makeRow(8, 6, 150, 280)
    },
    statusCopy: {
      idle: "等待中",
      running: "进行中",
      review: "可查看",
      failed: "已阻塞",
      waiting: "待处理",
      "running-left": "进行中",
      "running-right": "进行中",
      waving: "可查看",
      jumping: "进行中"
    },
    badgeThemeByState: {
      running: { bg: "#2f3f59", fg: "#f7fbff" },
      "running-left": { bg: "#2f3f59", fg: "#f7fbff" },
      "running-right": { bg: "#2f3f59", fg: "#f7fbff" },
      review: { bg: "#1b8f5a", fg: "#f6fff9" },
      waiting: { bg: "#d79d12", fg: "#fffaf0" },
      failed: { bg: "#c74646", fg: "#fff5f5" },
      idle: { bg: "#2f3f59", fg: "#f7fbff" },
      waving: { bg: "#1b8f5a", fg: "#f6fff9" },
      jumping: { bg: "#2f3f59", fg: "#f7fbff" }
    },
    priorityByState: {
      waiting: 0,
      failed: 1,
      review: 2,
      running: 3,
      idle: 4
    },
    expiryMsByState: {
      running: 180 * 1000,
      failed: 3600 * 1000,
      waiting: 1440 * 60 * 1000,
      review: 10080 * 60 * 1000
    }
  };
})();
