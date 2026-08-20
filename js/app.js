/* ============================================================
   app.js — shell: sidebar nav, views, stats + range filter,
   theme toggle, copilot reparenting (centered <-> floating),
   modals (schedule w/ media upload, automations), toasts, boot.
   Exposes: window.App, window.SchedulerUI, window.AutomationsUI
   ============================================================ */
(function () {
  "use strict";
  var D = window.PassesData;
  var S = window.Scheduler;
  var A = window.Automations;

  var currentView = "home";
  var currentRange = "week"; // matches the reference screenshot
  var CREATOR = "Ava";
  var els = {};

  /* ---------------- STATS + HEADER ---------------- */
  function renderStats() {
    var rows = D.rangeStats[currentRange] || D.rangeStats.week;
    els.stats.innerHTML = D.STAT_LABELS.map(function (label, i) {
      var s = rows[i] || { value: "0" };
      var delta = s.delta
        ? '<div class="stat__delta ' + (s.dir || "flat") + '">' + (s.dir === "up" ? "▲ " : s.dir === "down" ? "▼ " : "") + s.delta + '</div>'
        : "";
      return '<div class="stat"><div class="stat__label">' + label + '</div>' +
             '<div class="stat__value">' + s.value + '</div>' + delta + '</div>';
    }).join("");
  }

  function renderHeader() {
    if (currentView === "home") {
      els.head.innerHTML =
        '<div><h1 class="mainhead__title">Welcome back, ' + CREATOR + '!</h1></div>' +
        rangeFilterHTML();
      wireRangeFilter();
    } else if (currentView === "scheduler") {
      els.head.innerHTML = '<div><h1 class="mainhead__title">Smart Scheduler</h1>' +
        '<p class="mainhead__sub">Plan posts and mass DMs at the smartest times.</p></div>';
    } else {
      els.head.innerHTML = '<div><h1 class="mainhead__title">Automated Messages</h1>' +
        '<p class="mainhead__sub">Flows that message fans on autopilot.</p></div>';
    }
  }

  function rangeFilterHTML() {
    var cur = D.RANGES.filter(function (r) { return r.id === currentRange; })[0];
    var menu = D.RANGES.map(function (r) {
      return '<button data-range="' + r.id + '" class="' + (r.id === currentRange ? "is-active" : "") + '">' + r.label + '</button>';
    }).join("");
    return '<div class="rangefilter" id="rangeFilter">' +
      '<button class="rangefilter__btn" id="rangeBtn">' + cur.label +
      ' <svg viewBox="0 0 24 24" class="ic ic-sm"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="rangefilter__menu" id="rangeMenu" hidden>' + menu + '</div></div>';
  }
  function wireRangeFilter() {
    var btn = document.getElementById("rangeBtn");
    var menu = document.getElementById("rangeMenu");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    menu.querySelectorAll("[data-range]").forEach(function (b) {
      b.addEventListener("click", function () {
        currentRange = b.getAttribute("data-range");
        menu.hidden = true;
        renderHeader();
        renderStats();
      });
    });
    document.addEventListener("click", function () { if (menu) menu.hidden = true; });
  }

  /* ---------------- TIPS (what's new) ---------------- */
  function renderTips() {
    var w = D.bestWindows(1)[0];
    var peak = D.DAYS[w.day] + " " + D.fmtHour(w.hour);
    var tips = [
      { icon: "✦", title: "Copilot works on every page", desc: "Tap the Copilot button anywhere to schedule a post or mass DM in seconds." },
      { icon: "🕒", title: "Your fans peak at " + peak, desc: "Schedule your next drop then for the biggest reach." },
      { icon: "🔁", title: A.activeCount() + " automations running", desc: "New subscribers and win-backs are handled for you on autopilot." }
    ];
    els.tips.innerHTML = tips.map(function (t) {
      return '<div class="action-tip"><div class="action-tip__icon">' + t.icon + '</div>' +
             '<div class="action-tip__body"><div class="action-tip__title">' + t.title + '</div>' +
             '<div class="action-tip__desc">' + t.desc + '</div></div></div>';
    }).join("");
  }

  /* ---------------- VIEW SWITCHING ---------------- */
  function switchView(view) {
    if (view === "overview") view = "home";
    currentView = view;

    // nav highlight
    document.querySelectorAll(".navitem, .iconbtn[data-view]").forEach(function (n) {
      n.classList.toggle("is-active", n.getAttribute("data-view") === view);
    });

    // views
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.getAttribute("data-view") === view);
    });

    els.stats.style.display = view === "home" ? "" : "none";

    placeCopilot(view);
    renderHeader();
    if (view === "home") renderStats();
    renderCurrentPanel();
    closeSidebar();
  }

  function renderCurrentPanel() {
    if (currentView === "scheduler") S.renderPanel(els.views.scheduler);
    else if (currentView === "automations") A.renderPanel(els.views.automations);
  }

  function refresh() {
    if (currentView === "home") { renderStats(); renderTips(); }
    renderCurrentPanel();
  }

  /* ---------------- COPILOT: dock vs float ---------------- */
  function placeCopilot(view) {
    if (view === "home") {
      els.homeSlot.appendChild(els.copilot);
      els.floatDock.classList.add("is-hidden");
      els.fab.hidden = true;
    } else {
      els.floatDock.appendChild(els.copilot);
      // start collapsed: only the FAB shows until the creator opens it
      els.floatDock.classList.add("is-hidden");
      els.fab.hidden = false;
    }
  }
  function openFloatingCopilot() {
    els.floatDock.classList.remove("is-hidden");
    els.fab.hidden = true;
    var input = document.getElementById("chatInput");
    if (input) input.focus();
  }
  function minimizeCopilot() {
    if (currentView === "home") return; // hero can't be minimized
    els.floatDock.classList.add("is-hidden");
    els.fab.hidden = false;
  }

  /* ---------------- THEME ---------------- */
  function initTheme() {
    els.themeToggle.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("passes-theme", next); } catch (e) {}
      toast(next === "dark" ? "Dark mode on" : "Light mode on");
    });
  }

  /* ---------------- SIDEBAR (collapse + mobile) ---------------- */
  function initNav() {
    // tooltips for the collapsed (icon-only) state
    els.sidebar.querySelectorAll(".navitem").forEach(function (n) {
      var span = n.querySelector("span:not(.tag)");
      if (span && !n.title) n.title = span.textContent;
    });
    var toggle = document.getElementById("navToggle");
    function syncLabel() {
      var collapsed = document.documentElement.classList.contains("nav-collapsed");
      toggle.setAttribute("aria-label", collapsed ? "Expand menu" : "Collapse menu");
    }
    syncLabel();
    toggle.addEventListener("click", function () {
      var collapsed = document.documentElement.classList.toggle("nav-collapsed");
      try { localStorage.setItem("passes-nav", collapsed ? "collapsed" : "expanded"); } catch (e) {}
      syncLabel();
    });
  }
  function openSidebar() { els.sidebar.classList.add("is-open"); els.scrim.hidden = false; }
  function closeSidebar() { els.sidebar.classList.remove("is-open"); els.scrim.hidden = true; }

  /* ---------------- MODAL / TOASTS ---------------- */
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

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<span class="toast__ico">✦</span>' + msg;
    els.toasts.appendChild(t);
    var frames = 0;
    (function tick() {
      frames++;
      if (frames < 170) return requestAnimationFrame(tick);
      t.style.transition = "opacity .3s"; t.style.opacity = "0";
      var f2 = 0;
      (function fade() { if (f2++ < 20) return requestAnimationFrame(fade); t.remove(); })();
    })();
  }

  /* ================= SchedulerUI (modal w/ media upload) ============ */
  var mediaState = [];

  window.SchedulerUI = {
    openScheduleModal: function (editId) {
      var item = editId ? D.queue.filter(function (q) { return q.id === editId; })[0] : null;
      var isEdit = !!item;
      var kind = item ? item.kind : "post";
      var whenVal = item ? toLocalInput(item.when) : toLocalInput(S.suggestTime({}));
      var audience = item ? item.audience : "all";
      var price = item ? item.price : 0;
      var text = item ? item.text : "";
      mediaState = item && item.media ? item.media.slice() : [];

      var segOpts = D.segments.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === audience ? " selected" : "") + '>' + s.name + " (" + s.size.toLocaleString() + ")</option>";
      }).join("");

      var html =
        '<h2 class="modal__title">' + (isEdit ? "Edit scheduled content" : "Schedule content") + '</h2>' +
        '<p class="modal__sub">Add media, pick a time, and let the copilot handle timing, price, and caption.</p>' +
        '<div class="field"><label>Type</label><select id="m_kind">' +
        '<option value="post"' + (kind === "post" ? " selected" : "") + '>Feed post</option>' +
        '<option value="dm"' + (kind === "dm" ? " selected" : "") + '>Mass DM</option></select></div>' +
        '<div class="field"><label>Media</label>' +
        '  <div class="dropzone" id="m_drop"><div class="dropzone__ico">🖼️</div>' +
        '  <div>Drag photos or videos here, or <strong>browse</strong></div>' +
        '  <div class="dropzone__hint">Images and video up to your plan limit. Stored in your Vault.</div></div>' +
        '  <input type="file" id="m_file" accept="image/*,video/*" multiple hidden />' +
        '  <div class="media-grid" id="m_media"></div>' +
        '</div>' +
        '<div class="field"><label>Audience</label><select id="m_aud">' + segOpts + '</select></div>' +
        '<div class="field"><label>When</label><input id="m_when" type="datetime-local" value="' + whenVal + '"/>' +
        '<div class="small muted" id="m_quality" style="margin-top:6px"></div></div>' +
        '<div class="field"><label>Unlock price (0 = free)</label><input id="m_price" type="number" min="0" value="' + price + '"/></div>' +
        '<div class="field"><label>Caption / message</label><textarea id="m_text" placeholder="Write something, or let the copilot draft it">' + S.esc(text) + '</textarea>' +
        '<button class="btn btn--ghost btn--sm" id="m_gen">✦ Generate caption</button> ' +
        '<button class="btn btn--ghost btn--sm" id="m_best">✦ Best time</button> ' +
        '<button class="btn btn--ghost btn--sm" id="m_price_smart">✦ Smart price</button></div>' +
        '<div class="modal__foot">' +
        '<button class="btn btn--ghost" data-close-modal>Cancel</button>' +
        '<button class="btn btn--primary" id="m_save">' + (isEdit ? "Save changes" : "Add to queue") + '</button></div>';

      openModal(html);
      wireModalClose();
      wireMediaUpload();

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
        document.getElementById("m_text").value = S.generateCaption({ kind: document.getElementById("m_kind").value, nonce: ++genN });
      });
      document.getElementById("m_best").addEventListener("click", function (e) {
        e.preventDefault(); whenEl.value = toLocalInput(S.suggestTime({})); updateQuality();
      });
      document.getElementById("m_price_smart").addEventListener("click", function (e) {
        e.preventDefault();
        document.getElementById("m_price").value = S.suggestPrice({
          kind: document.getElementById("m_kind").value, audience: document.getElementById("m_aud").value
        }).mid;
      });

      document.getElementById("m_save").addEventListener("click", function () {
        var payload = {
          kind: document.getElementById("m_kind").value,
          audience: document.getElementById("m_aud").value,
          when: fromLocalInput(document.getElementById("m_when").value) || S.suggestTime({}),
          price: parseInt(document.getElementById("m_price").value, 10) || 0,
          text: document.getElementById("m_text").value.trim() || S.generateCaption({ kind: "post" }),
          media: mediaState.slice(),
          status: "scheduled"
        };
        if (isEdit) { S.updateItem(editId, payload); toast("Changes saved"); }
        else {
          payload.source = "manual";
          payload.smart = { time: false, caption: false, price: false };
          S.addToQueue(payload);
          toast("Added to your queue");
        }
        closeModal();
        switchView("scheduler");
      });
    }
  };

  function wireMediaUpload() {
    var drop = document.getElementById("m_drop");
    var file = document.getElementById("m_file");
    if (!drop) return;
    drop.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () { addFiles(file.files); file.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
    renderMedia();
  }
  function addFiles(fileList) {
    Array.prototype.forEach.call(fileList, function (f) {
      var kind = /^image\//.test(f.type) ? "image" : /^video\//.test(f.type) ? "video" : "file";
      var url = "";
      try { url = (kind === "image" || kind === "video") ? URL.createObjectURL(f) : ""; } catch (e) {}
      mediaState.push({ name: f.name, kind: kind, url: url });
    });
    renderMedia();
  }
  function renderMedia() {
    var wrap = document.getElementById("m_media");
    if (!wrap) return;
    wrap.innerHTML = mediaState.map(function (m, i) {
      var inner = m.kind === "image" && m.url ? '<img src="' + m.url + '" alt="" />'
        : m.kind === "video" && m.url ? '<video src="' + m.url + '" muted></video>'
        : (m.kind === "video" ? "🎬" : "📄");
      return '<div class="media-thumb" data-i="' + i + '">' + inner +
        '<button class="media-thumb__rm" data-rm="' + i + '" title="Remove">×</button>' +
        '<span class="media-thumb__name">' + S.esc(m.name) + '</span></div>';
    }).join("");
    wrap.querySelectorAll("[data-rm]").forEach(function (b) {
      b.addEventListener("click", function () {
        mediaState.splice(parseInt(b.getAttribute("data-rm"), 10), 1);
        renderMedia();
      });
    });
  }

  /* ================= AutomationsUI (modal) ================= */
  window.AutomationsUI = {
    openDetail: function (id) { var a = A.findFlow(id); if (a) renderFlowModal(a, false); },
    openDraftPreview: function (draft) { renderFlowModal(draft, true); },
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
        '<p class="modal__sub">Pick a trigger and the copilot drafts a starter flow you can refine.</p>' +
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
      function upd() { var t = D.triggerById(trigEl.value); descEl.textContent = t ? t.desc : ""; }
      trigEl.addEventListener("change", upd); upd();
      document.getElementById("b_create").addEventListener("click", function () {
        var flow = A.createFlow({ trigger: trigEl.value, name: nameEl.value.trim() || null });
        closeModal(); switchView("automations"); toast("Flow created");
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
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
      '<div><h2 class="modal__title">' + S.esc(a.name) + '</h2>' +
      '<p class="modal__sub">Trigger: ' + trig.icon + " " + trig.name + " · " + a.steps.length + " steps</p></div>" +
      (isDraft ? "" : statusPill) + '</div>';
    var foot = isDraft
      ? '<div class="modal__foot"><button class="btn btn--ghost" data-close-modal>Close</button></div>'
      : '<div class="modal__foot"><button class="btn btn--danger" id="f_del">Delete</button>' +
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
    document.querySelectorAll("[data-close-modal]").forEach(function (b) { b.addEventListener("click", closeModal); });
  }

  /* ---------------- datetime helpers ---------------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toLocalInput(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fromLocalInput(v) {
    if (!v) return null;
    var m = v.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0) : null;
  }

  /* ---------------- BOOT ---------------- */
  function boot() {
    els.sidebar = document.getElementById("sidebar");
    els.scrim = document.getElementById("sidebarScrim");
    els.head = document.getElementById("mainHead");
    els.stats = document.getElementById("statsRow");
    els.tips = document.getElementById("tipsList");
    els.views = {
      scheduler: document.getElementById("view-scheduler"),
      automations: document.getElementById("view-automations")
    };
    els.homeSlot = document.getElementById("homeCopilotSlot");
    els.floatDock = document.getElementById("floatDock");
    els.copilot = document.getElementById("copilot");
    els.fab = document.getElementById("copilotFab");
    els.themeToggle = document.getElementById("themeToggle");
    els.modal = document.getElementById("modal");
    els.modalCard = document.getElementById("modalCard");
    els.toasts = document.getElementById("toasts");

    els.modal.querySelector(".modal__backdrop").addEventListener("click", closeModal);

    // nav (view switchers + "coming soon" tools) — scoped to the sidebar so
    // clicks inside a <section class="view" data-view="..."> don't bubble up here.
    els.sidebar.querySelectorAll("[data-view]").forEach(function (n) {
      n.addEventListener("click", function () { switchView(n.getAttribute("data-view")); });
    });
    els.sidebar.querySelectorAll("[data-soon]").forEach(function (n) {
      n.addEventListener("click", function () { toast(n.getAttribute("data-soon") + " is not part of this prototype"); });
    });

    // copilot float controls
    els.fab.addEventListener("click", openFloatingCopilot);
    document.getElementById("copilotMin").addEventListener("click", minimizeCopilot);

    // mobile menu
    document.getElementById("menuBtn").addEventListener("click", openSidebar);
    els.scrim.addEventListener("click", closeSidebar);

    initTheme();
    initNav();
    renderTips();
    switchView("home");     // places copilot in the hero slot + renders header/stats
    window.Chatbot.init();
  }

  // keep the copilot visible after an action (float open when off-home)
  function showCopilot() { if (currentView !== "home") openFloatingCopilot(); }

  window.App = {
    refresh: refresh,
    switchView: switchView,
    switchTab: switchView, // alias for chatbot
    showCopilot: showCopilot,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
