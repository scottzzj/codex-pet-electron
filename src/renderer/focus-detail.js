(function () {
  const elements = {
    title: document.getElementById("focus-title"),
    timer: document.getElementById("focus-timer"),
    actions: document.getElementById("focus-actions"),
    close: document.getElementById("focus-close")
  };

  let detailState = null;
  function renderActions() {
    if (!detailState) {
      elements.actions.innerHTML = "";
      return;
    }

    if (detailState.status === "running") {
      elements.actions.innerHTML = [
        detailState.canPause
          ? '<button type="button" class="focus-detail-action secondary" data-action="focus-pause">暂停</button>'
          : '<button type="button" class="focus-detail-action secondary" disabled>暂停次数已用完</button>',
        '<button type="button" class="focus-detail-action" data-action="focus-stop">结束</button>'
      ].join("");
      return;
    }

    if (detailState.status === "paused") {
      elements.actions.innerHTML = [
        '<button type="button" class="focus-detail-action secondary" data-action="focus-resume">继续</button>',
        '<button type="button" class="focus-detail-action" data-action="focus-stop">结束</button>'
      ].join("");
      return;
    }

    if (detailState.status === "completed") {
      elements.actions.innerHTML = [
        '<button type="button" class="focus-detail-action" data-action="focus-stop">关闭</button>'
      ].join("");
      return;
    }

    elements.actions.innerHTML = "";
  }

  function render() {
    if (!detailState) {
      return;
    }

    elements.title.textContent = detailState.title || "专注计时";
    elements.timer.textContent = detailState.timerText || "00:00";
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
