(function () {
  const elements = {
    title: document.getElementById("focus-title"),
    timer: document.getElementById("focus-timer"),
    status: document.getElementById("focus-status"),
    actions: document.getElementById("focus-actions"),
    close: document.getElementById("focus-close")
  };

  let detailState = null;

  function createActionButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.secondary
      ? "focus-detail-action secondary"
      : "focus-detail-action";
    button.textContent = options.label;

    if (options.action) {
      button.setAttribute("data-action", options.action);
    }
    if (options.disabled) {
      button.disabled = true;
    }

    return button;
  }

  function renderActions() {
    elements.actions.replaceChildren();

    if (!detailState) {
      return;
    }

    if (detailState.status === "running") {
      elements.actions.append(
        createActionButton({
          label: detailState.canPause ? "暂停" : "暂停次数已用完",
          action: detailState.canPause ? "focus-pause" : "",
          secondary: true,
          disabled: !detailState.canPause
        }),
        createActionButton({
          label: "结束",
          action: "focus-stop"
        })
      );
      return;
    }

    if (detailState.status === "paused") {
      elements.actions.append(
        createActionButton({
          label: "继续",
          action: "focus-resume",
          secondary: true
        }),
        createActionButton({
          label: "结束",
          action: "focus-stop"
        })
      );
      return;
    }

    if (detailState.status === "completed") {
      elements.actions.append(createActionButton({
        label: "关闭",
        action: "focus-stop"
      }));
    }
  }

  function render() {
    if (!detailState) {
      return;
    }

    elements.title.textContent = detailState.title || "专注计时";
    elements.timer.textContent = detailState.timerText || "00:00";
    elements.status.textContent = detailState.statusText || "未开始";
    renderActions();
  }

  elements.close.addEventListener("click", function () {
    window.petBridge.sendFocusDetailAction({ id: "focus-detail-close" });
  });

  elements.actions.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    window.petBridge.sendFocusDetailAction({ id: button.getAttribute("data-action") });
  });

  window.petBridge.onFocusDetailState(function (payload) {
    detailState = payload;
    render();
  });
})();
