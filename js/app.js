/* ============================================================
   app.js — dashboard shell: stats, overview, tabs, modals,
   toasts, copilot open/close, and boot.
   Exposes: window.App, window.SchedulerUI, window.AutomationsUI
   ============================================================ */
(function () {
  "use strict";
  var D = window.PassesData;
  var S = window.Scheduler;
  var A = window.Automations;

  var currentTab = "overview";
  var els = {};

  /* ---------------- STATS ---------------- */
  function renderStats() {
    // keep the "scheduled" stat live
    D.stats[3].value = String(S.scheduledCount());
    var html = D.stats.map(function (s) {
      var dcls = s.dir === "up" ? "up" : s.dir === "down" ? "down" : "";
      var delta = s.dir === "flat"
        ? '<span class="stat__delta muted">' + s.delta + '</span>'
        : '<span class="stat__delta ' + dcls + '">' + (s.dir === "up" ? "▲ " : "▼ ") + s.delta + '</span>';
      return '' +
        '<div class="stat">' +
        '  <div class="stat__label">' + s.label + '</div>' +
        '  <div class="stat__value">' + s.value + '</div>' +
        delta +
        '</div>';
    }).join("");
    els.stats.innerHTML = html;
  }

  /* ---------------- OVERVIEW ---------------- */
  function renderOverview() {
    var next = D.queue.filter(function (q) { return q.status === "scheduled"; })[0];
    var nextTxt = next
      ? (next.kind === "dm" ? "Mass DM" : "Post") + " · " + whenShort(next.when)
      : "Nothing queued";
    var activeAutos = A.activeCount();

    var tips = [
      { icon: "🕒", title: "Your fans peak at " + peakLabel(), desc: "Schedule tonight's drop then for the biggest reach. Ask the copilot to queue it." },
      { icon: "💸", title: "Try a paid mass DM to VIPs", desc: "Your top spenders convert best. A $" + S.suggestPrice({ kind: "dm", audience: "vip" }).mid + " unlock is a strong bet." },
      { icon: "🔁", title: activeAutos + " automations running", desc: "New subscribers and win-backs are handled on autopilot. Add one for tips or birthdays." }
    ];

    var html = "";
    html += '<div class="overview-grid">';

    // left: engagement heatmap
    html += '<div class="card">';
    html += '  <div class="card__head"><div><h3 class="card__title">When your fans are online</h3>';
    html += '  <p class="card__sub">Darker = more active. The copilot schedules into these peaks automatically.</p></div></div>';
    html += heatmapHTML();
    html += '</div>';

    // right: what's next + smart tips
    html += '<div>';
    html += '  <div class="card">';
    html += '    <div class="card__head"><div><h3 class="card__title">Up next</h3></div>';
    html += '    <button class="btn btn--ghost btn--sm" data-goto="scheduler">View queue</button></div>';
    if (next) {
      var q = S.timeQuality(next.when);
      html += '<div class="action-tip">';
      html += '  <div class="action-tip__icon">' + (next.kind === "dm" ? "💌" : "🖼️") + '</div>';
      html += '  <div class="action-tip__body"><div class="action-tip__title">' + nextTxt + '</div>';
      html += '  <div class="action-tip__desc">' + S.esc(trim(next.text, 70)) + '</div>';
      html += '  <div class="small" style="margin-top:6px"><span class="stat__delta ' + q.cls + '">' + q.label + '</span></div></div>';
      html += '</div>';
    } else {
      html += '<div class="empty">Ask the copilot to schedule something 👉</div>';
    }
    html += '  </div>';

    html += '  <div class="card">';
    html += '    <div class="card__head"><div><h3 class="card__title">Smart tips</h3></div></div>';
    html += '    <div class="actionlist">';
    tips.forEach(function (t) {
      html += '<div class="action-tip"><div class="action-tip__icon">' + t.icon + '</div>' +
              '<div class="action-tip__body"><div class="action-tip__title">' + t.title + '</div>' +
              '<div class="action-tip__desc">' + t.desc + '</div></div></div>';
    });
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    html += '</div>';
    els.panels.overview.innerHTML = html;

    els.panels.overview.querySelectorAll("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () { switchTab(b.getAttribute("data-goto")); });
    });
  }

  function heatmapHTML() {
    var hoursHeader = '<div class="heatmap__hours"><span></span>';
    for (var h = 0; h < 24; h++) hoursHeader += "<span>" + (h % 6 === 0 ? h : "") + "</span>";
    hoursHeader += "</div>";

    var best = D.bestWindows(6);
    function isBest(d, h) { return best.some(function (w) { return w.day === d && w.hour === h; }); }

    var rows = "";
    for (var d = 0; d < 7; d++) {
      rows += '<div class="heatmap__row"><span class="heatmap__day">' + D.DAYS[d] + "</span>";
      for (var hr = 0; hr < 24; hr++) {
        var v = D.engagement[d][hr];
        rows += '<div class="heat" data-best="' + (isBest(d, hr) ? 1 : 0) + '" style="background:' + heatColor(v) + '" title="' + D.DAYS[d] + " " + D.fmtHour(hr) + ' · ' + v + '/100"></div>';
      }
      rows += "</div>";
    }

    var legend =
      '<div class="heatmap__legend">Less' +
      '<span class="heatmap__scale">' +
      [10,30,50,70,90].map(function (v) { return '<span style="background:' + heatColor(v) + '"></span>'; }).join("") +
      '</span>More · <span style="color:var(--pb-200)">outlined = top window</span></div>';

    return '<div class="heatmap">' + hoursHeader + rows + "</div>" + legend;
  }
  function heatColor(v) {
    // interpolate from dark surface to powder blue by activity
    var t = Math.max(0, Math.min(1, v / 100));
    // base #1B262C -> pb-400 #22CCEE
    var a = [27, 38, 44], b = [34, 204, 238];
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }
  function peakLabel() {
    var w = D.bestWindows(1)[0];
    return D.DAYS[w.day] + " " + D.fmtHour(w.hour);
  }

  /* ---------------- TABS ---------------- */
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("is-active", t.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".tabpanel").forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-panel") === tab);
    });
    renderCurrentPanel();
  }
  function renderCurrentPanel() {
    if (currentTab === "overview") renderOverview();
    else if (currentTab === "scheduler") S.renderPanel(els.panels.scheduler);
    else if (currentTab === "automations") A.renderPanel(els.panels.automations);
  }

  function refresh() {
    renderStats();
    renderCurrentPanel();
  }

  /* ---------------- MODAL ---------------- */
  function openModal(html) {
    els.modalCard.innerHTML = html;
    els.modal.hidden = false;
    document.addEventListener("keydown", escClose);
  }
  function closeModal() {
    els.modal.hidden = true;
    els.modalCard.innerHTML = "";
    document.removeEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }

  /* ---------------- TOASTS ---------------- */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<span class="toast__ico">✦</span>' + msg;
    els.toasts.appendChild(t);
    var frames = 0;
    (function tick() {
      frames++;
      if (frames < 180) return requestAnimationFrame(tick);
      t.style.transition = "opacity .3s"; t.style.opacity = "0";
      var f2 = 0;
      (function fade() { if (f2++ < 20) return requestAnimationFrame(fade); t.remove(); })();
    })();
  }

  /* ---------------- COPILOT open/close ---------------- */
  function setupCopilot() {
    var copilot = document.getElementById("copilot");
    var fab = document.getElementById("openChat");
    var closeBtn = document.getElementById("closeChat");
    var openMobile = document.getElementById("openChatMobile");

    function isMobile() { return window.matchMedia("(max-width: 900px)").matches; }

    closeBtn.addEventListener("click", function () {
      if (isMobile()) { copilot.classList.remove("is-open"); }
      else { copilot.classList.add("is-collapsed"); fab.hidden = false; }
    });
    fab.addEventListener("click", function () {
      copilot.classList.remove("is-collapsed"); fab.hidden = true;
    });
    openMobile.addEventListener("click", function () {
      copilot.classList.add("is-open");
    });
  }

  /* ---------------- helpers ---------------- */
  function trim(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function whenShort(d) {
    var dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
    var today = new Date(); today.setHours(0,0,0,0);
    var that = new Date(d); that.setHours(0,0,0,0);
    var diff = Math.round((that - today) / 86400000);
    var rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : dayName;
    return rel + ", " + D.fmtHourMin(d);
  }

  /* ================= SchedulerUI (modal) ================= */
  window.SchedulerUI = {
    openScheduleModal: function (editId) {
      var item = editId ? D.queue.filter(function (q) { return q.id === editId; })[0] : null;
      var isEdit = !!item;
      var kind = item ? item.kind : "post";
      var when = item ? toLocalInput(item.when) : toLocalInput(S.suggestTime({}));
      var audience = item ? item.audience : "all";
      var price = item ? item.price : 0;
      var text = item ? item.text : "";

      var segOpts = D.segments.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === audience ? " selected" : "") + '>' + s.name + " (" + s.size.toLocaleString() + ")</option>";
      }).join("");

      var html =
        '<h2 class="modal__title">' + (isEdit ? "Edit scheduled content" : "Schedule content") + '</h2>' +
        '<p class="modal__sub">The copilot can do this in one sentence, but here are the controls.</p>' +
        '<div class="field"><label>Type</label><select id="m_kind">' +
        '<option value="post"' + (kind === "post" ? " selected" : "") + '>Feed post</option>' +
        '<option value="dm"' + (kind === "dm" ? " selected" : "") + '>Mass DM</option></select></div>' +
        '<div class="field"><label>Audience</label><select id="m_aud">' + segOpts + '</select></div>' +
        '<div class="field"><label>When</label><input id="m_when" type="datetime-local" value="' + when + '"/>' +
        '<div class="small muted" id="m_quality" style="margin-top:6px"></div></div>' +
        '<div class="field"><label>Unlock price (0 = free)</label><input id="m_price" type="number" min="0" value="' + price + '"/></div>' +
        '<div class="field"><label>Caption / message</label><textarea id="m_text" placeholder="Write something, or let the copilot draft it">' + S.esc(text) + '</textarea>' +
        '<button class="btn btn--ghost btn--sm" id="m_gen" style="margin-top:8px">✦ Generate caption</button>' +
        '<button class="btn btn--ghost btn--sm" id="m_best" style="margin-top:8px">✦ Best time</button>' +
        '<button class="btn btn--ghost btn--sm" id="m_price_smart" style="margin-top:8px">✦ Smart price</button></div>' +
        '<div class="modal__foot">' +
        '<button class="btn btn--ghost" data-close-modal>Cancel</button>' +
        '<button class="btn btn--primary" id="m_save">' + (isEdit ? "Save changes" : "Add to queue") + '</button></div>';

      openModal(html);
      wireModalClose();

      var whenEl = document.getElementById("m_when");
      var qEl = document.getElementById("m_quality");
      function updateQuality() {
        var d = fromLocalInput(whenEl.value);
        if (!d) { qEl.textContent = ""; return; }
        var q = S.timeQuality(d);
        qEl.innerHTML = '<span class="stat__delta ' + q.cls + '">' + q.label + '</span> · fan activity ' + S.scoreForTime(d) + '/100';
      }
      whenEl.addEventListener("input", updateQuality);
      updateQuality();

      var genN = 0;
      document.getElementById("m_gen").addEventListener("click", function (e) {
        e.preventDefault();
        var k = document.getElementById("m_kind").value;
        document.getElementById("m_text").value = S.generateCaption({ kind: k, topic: null, nonce: ++genN });
      });
      document.getElementById("m_best").addEventListener("click", function (e) {
        e.preventDefault();
        whenEl.value = toLocalInput(S.suggestTime({}));
        updateQuality();
      });
      document.getElementById("m_price_smart").addEventListener("click", function (e) {
        e.preventDefault();
        var k = document.getElementById("m_kind").value;
        var a = document.getElementById("m_aud").value;
        document.getElementById("m_price").value = S.suggestPrice({ kind: k, audience: a }).mid;
      });

      document.getElementById("m_save").addEventListener("click", function () {
        var payload = {
          kind: document.getElementById("m_kind").value,
          audience: document.getElementById("m_aud").value,
          when: fromLocalInput(document.getElementById("m_when").value) || S.suggestTime({}),
          price: parseInt(document.getElementById("m_price").value, 10) || 0,
          text: document.getElementById("m_text").value.trim() || S.generateCaption({ kind: "post" }),
          status: "scheduled"
        };
        if (isEdit) {
          S.updateItem(editId, payload);
          toast("Changes saved");
        } else {
          payload.source = "manual";
          payload.smart = { time: false, caption: false, price: false };
          S.addToQueue(payload);
          toast("Added to your queue");
        }
        closeModal();
        refresh();
      });
    }
  };

  /* ================= AutomationsUI (modal) ================= */
  window.AutomationsUI = {
    openDetail: function (id) {
      var a = A.findFlow(id);
      if (!a) return;
      renderFlowModal(a, false);
    },
    openDraftPreview: function (draft) {
      renderFlowModal(draft, true);
    },
    openBuilder: function () {
      var groups = {};
      D.triggers.forEach(function (t) { (groups[t.group] = groups[t.group] || []).push(t); });
      var opts = "";
      Object.keys(groups).forEach(function (g) {
        opts += '<optgroup label="' + g + '">';
        groups[g].forEach(function (t) { opts += '<option value="' + t.id + '">' + t.icon + " " + t.name + "</option>"; });
        opts += "</optgroup>";
      });
      var html =
        '<h2 class="modal__title">New automation</h2>' +
        '<p class="modal__sub">Pick a trigger and the copilot drafts a starter flow you can refine. Or just tell the copilot in plain words.</p>' +
        '<div class="field"><label>Trigger (' + D.triggers.length + ' available)</label><select id="b_trig">' + opts + '</select>' +
        '<div class="small muted" id="b_desc" style="margin-top:6px"></div></div>' +
        '<div class="field"><label>Name</label><input id="b_name" type="text" placeholder="e.g. Welcome new subscribers"/></div>' +
        '<div class="modal__foot"><button class="btn btn--ghost" data-close-modal>Cancel</button>' +
        '<button class="btn btn--primary" id="b_create">Create flow</button></div>';
      openModal(html);
      wireModalClose();

      var trigEl = document.getElementById("b_trig");
      var descEl = document.getElementById("b_desc");
      var nameEl = document.getElementById("b_name");
      function upd() {
        var t = D.triggerById(trigEl.value);
        descEl.textContent = t ? t.desc : "";
        if (!nameEl.value) nameEl.placeholder = "e.g. " + (t ? t.name + " flow" : "");
      }
      trigEl.addEventListener("change", upd); upd();

      document.getElementById("b_create").addEventListener("click", function () {
        var flow = A.createFlow({ trigger: trigEl.value, name: nameEl.value.trim() || null });
        closeModal();
        switchTab("automations");
        refresh();
        toast("Flow created");
        window.AutomationsUI.openDetail(flow.id);
      });
    }
  };

  function renderFlowModal(a, isDraft) {
    var trig = D.triggerById(a.trigger) || { icon: "⚡", name: a.trigger };
    var statusPill = a.status === "active"
      ? '<span class="pill pill--active">● Live</span>'
      : '<span class="pill pill--paused">● Paused</span>';
    var head =
      '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
      '<div><h2 class="modal__title">' + S.esc(a.name) + '</h2>' +
      '<p class="modal__sub">Trigger: ' + trig.icon + " " + trig.name + " · " + a.steps.length + " steps</p></div>" +
      (isDraft ? "" : statusPill) + '</div>';

    var foot = isDraft
      ? '<div class="modal__foot"><button class="btn btn--ghost" data-close-modal>Close</button></div>'
      : '<div class="modal__foot">' +
        '<button class="btn btn--danger" id="f_del">Delete</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn--ghost" id="f_toggle">' + (a.status === "active" ? "Pause" : "Activate") + '</button>' +
        '<button class="btn btn--primary" data-close-modal>Done</button></div>';

    openModal(head + '<div style="margin:6px 0 14px">' + A.flowHTML(a) + "</div>" + foot);
    wireModalClose();

    if (!isDraft) {
      document.getElementById("f_toggle").addEventListener("click", function () {
        A.toggleFlow(a.id); closeModal(); refresh(); toast(a.status === "active" ? "Automation live" : "Automation paused");
      });
      document.getElementById("f_del").addEventListener("click", function () {
        A.deleteFlow(a.id); closeModal(); refresh(); toast("Automation deleted");
      });
    }
  }

  function wireModalClose() {
    document.querySelectorAll("[data-close-modal]").forEach(function (b) {
      b.addEventListener("click", closeModal);
    });
  }

  /* --------- datetime-local helpers --------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toLocalInput(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
           "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fromLocalInput(v) {
    if (!v) return null;
    var m = v.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  }

  /* ---------------- BOOT ---------------- */
  function boot() {
    els.stats = document.getElementById("statsRow");
    els.panels = {
      overview: document.getElementById("panel-overview"),
      scheduler: document.getElementById("panel-scheduler"),
      automations: document.getElementById("panel-automations")
    };
    els.modal = document.getElementById("modal");
    els.modalCard = document.getElementById("modalCard");
    els.toasts = document.getElementById("toasts");

    els.modal.querySelector(".modal__backdrop").addEventListener("click", closeModal);

    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.getAttribute("data-tab")); });
    });

    renderStats();
    renderOverview();
    setupCopilot();
    window.Chatbot.init();
  }

  window.App = { refresh: refresh, switchTab: switchTab, toast: toast, openModal: openModal, closeModal: closeModal };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
