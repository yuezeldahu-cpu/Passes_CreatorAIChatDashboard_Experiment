/* ============================================================
   automations.js — Automated Messages engine + UI
   - 20+ triggers (from data.js)
   - conditional logic + multi-step flows (up to 20 steps)
   - timed delays, rich text
   - flow list + flow builder / detail view
   Exposes: window.Automations
   ============================================================ */
(function () {
  "use strict";
  var D = window.PassesData;
  var MAX_STEPS = 20;

  /* ---------- FLOW CRUD ---------- */
  function createFlow(opts) {
    opts = opts || {};
    var trig = D.triggerById(opts.trigger) || D.triggers[0];
    var flow = {
      id: D.uid(),
      name: opts.name || defaultName(trig),
      trigger: trig.id,
      status: opts.status || "active",
      sent: 0, conv: "0%",
      steps: opts.steps && opts.steps.length ? opts.steps.slice(0, MAX_STEPS) : defaultSteps(trig)
    };
    D.automations.unshift(flow);
    return flow;
  }
  function defaultName(trig) {
    var map = {
      new_sub: "Welcome new subscribers",
      trial_start: "Convert free trials",
      sub_expired: "Win back expired subs",
      unfollow: "Save unfollowers",
      big_tip: "Thank big tippers",
      first_purchase: "Reward first purchase",
      birthday: "Birthday surprise",
      inactive_7: "Re-engage quiet fans",
      livestream: "Livestream reminder"
    };
    return map[trig.id] || (trig.name + " flow");
  }
  // Sensible starter flow per trigger so a one-line request yields something real.
  function defaultSteps(trig) {
    switch (trig.id) {
      case "new_sub":
        return [
          { type: "message", delay: 0, text: "hey {{name}}! 🥹 so hyped you're here. welcome to the inner circle 💫" },
          { type: "delay", delay: 1440 },
          { type: "message", delay: 0, price: 9, text: "since you're new, here's 30% off my most-loved set 🎁 unlock below 👀" }
        ];
      case "trial_start":
        return [
          { type: "message", delay: 0, text: "welcome to the trial {{name}} 👋 take a look around, the good stuff is all here." },
          { type: "delay", delay: 2880 },
          { type: "condition", delay: 0, cond: "still_on_trial", label: "If still on trial" },
          { type: "message", delay: 0, text: "your trial's almost up 🥺 lock in the full experience before it ends. worth it, promise." }
        ];
      case "sub_expired":
        return [
          { type: "delay", delay: 2880 },
          { type: "message", delay: 0, text: "miss you already {{name}} 🥺 come back and I'll make it worth it." },
          { type: "delay", delay: 4320 },
          { type: "message", delay: 0, text: "resubscribe this week and your first month is 40% off 💌" }
        ];
      case "unfollow":
        return [
          { type: "message", delay: 0, text: "aw you're heading out 😢 no hard feelings. reply 'stay' for something special." },
          { type: "condition", delay: 0, cond: "replied_stay", label: "If they reply 'stay'" },
          { type: "message", delay: 0, text: "you said the magic word ✨ here's 50% off to keep you around 💪" }
        ];
      case "big_tip":
        return [
          { type: "message", delay: 0, text: "{{name}} you did NOT have to 🥹 thank you so much. sending you a little something 💋" },
          { type: "delay", delay: 5 },
          { type: "message", delay: 0, text: "here's an exclusive just for you, on the house 🎁" }
        ];
      case "first_purchase":
        return [
          { type: "message", delay: 0, text: "your first unlock! 🎉 you're officially one of my faves now {{name}} 😌" }
        ];
      case "birthday":
        return [
          { type: "message", delay: 0, text: "HAPPY BIRTHDAY {{name}} 🎂🎉 you're getting spoiled today, check your DMs 💝" }
        ];
      case "inactive_7":
        return [
          { type: "message", delay: 0, text: "hey stranger 👀 it's been a minute {{name}}. here's what you've been missing..." },
          { type: "delay", delay: 60 },
          { type: "message", delay: 0, price: 8, text: "sneak peek unlocked just for you 🔓 welcome back 💕" }
        ];
      case "livestream":
        return [
          { type: "message", delay: 0, text: "going LIVE in 15 🎥 don't miss it {{name}}, it's gonna be a good one." }
        ];
      default:
        return [
          { type: "message", delay: 0, text: "hey {{name}} 👋 just wanted to reach out 💫" }
        ];
    }
  }

  function findFlow(id) {
    for (var i = 0; i < D.automations.length; i++) if (D.automations[i].id === id) return D.automations[i];
    return null;
  }
  function toggleFlow(id) {
    var f = findFlow(id);
    if (f) f.status = f.status === "active" ? "paused" : "active";
    return f;
  }
  function deleteFlow(id) {
    for (var i = 0; i < D.automations.length; i++) {
      if (D.automations[i].id === id) { D.automations.splice(i, 1); return true; }
    }
    return false;
  }
  function addStep(id, step) {
    var f = findFlow(id);
    if (!f) return null;
    if (f.steps.length >= MAX_STEPS) return { error: "A flow can have at most " + MAX_STEPS + " steps." };
    f.steps.push(step);
    return f;
  }
  function activeCount() {
    return D.automations.filter(function (a) { return a.status === "active"; }).length;
  }

  /* ---------- RENDER: LIST ---------- */
  function renderPanel(el) {
    var html = "";
    html += '<div class="card">';
    html += '  <div class="card__head">';
    html += '    <div><h3 class="card__title">Automations</h3>';
    html += '    <p class="card__sub">Flows that message fans on autopilot. ' + activeCount() + ' active &middot; ' + D.triggers.length + ' triggers available.</p></div>';
    html += '    <button class="btn btn--primary btn--sm" data-new-auto>+ New automation</button>';
    html += '  </div>';

    if (!D.automations.length) {
      html += '<div class="empty">No automations yet. Ask your copilot: <em>"welcome new subscribers with a discount."</em></div>';
    } else {
      html += '<div class="autolist">';
      D.automations.forEach(function (a) { html += autoRowHTML(a); });
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;

    el.querySelector("[data-new-auto]").addEventListener("click", function () {
      window.AutomationsUI.openBuilder();
    });
    el.querySelectorAll(".auto").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector("[data-open]").addEventListener("click", function () {
        window.AutomationsUI.openDetail(id);
      });
      var sw = row.querySelector("input[type=checkbox]");
      sw.addEventListener("change", function () {
        toggleFlow(id);
        window.App.refresh();
        window.App.toast(sw.checked ? "Automation live" : "Automation paused");
      });
    });
  }

  function autoRowHTML(a) {
    var trig = D.triggerById(a.trigger) || { icon: "⚡", name: a.trigger };
    var statusPill = a.status === "active"
      ? '<span class="pill pill--active">● Live</span>'
      : '<span class="pill pill--paused">● Paused</span>';
    var msgCount = a.steps.filter(function (s) { return s.type === "message"; }).length;
    return '' +
      '<div class="auto" data-id="' + a.id + '">' +
      '  <div class="auto__icon">' + trig.icon + '</div>' +
      '  <div>' +
      '    <div class="auto__name">' + window.Scheduler.esc(a.name) + '</div>' +
      '    <div class="auto__trig">When: <strong>' + trig.name + '</strong></div>' +
      '    <div class="auto__stat">' + a.steps.length + ' steps &middot; ' + msgCount + ' messages &middot; ' +
             a.sent.toLocaleString() + ' sent &middot; ' + a.conv + ' converted</div>' +
      '  </div>' +
      '  <div class="auto__right">' +
             statusPill +
      '    <label class="switch"><input type="checkbox" ' + (a.status === "active" ? "checked" : "") + '/><span class="switch__track"></span></label>' +
      '    <button class="btn btn--ghost btn--sm" data-open>Open</button>' +
      '  </div>' +
      '</div>';
  }

  /* ---------- RENDER: FLOW (used in detail view) ---------- */
  function flowHTML(a) {
    var trig = D.triggerById(a.trigger) || { icon: "⚡", name: a.trigger, desc: "" };
    var html = '<div class="flow">';
    // trigger node
    html += node("trigger", "Trigger", trig.icon + " " + trig.name, trig.desc, null);
    a.steps.forEach(function (s, i) {
      html += connector(s);
      if (s.type === "delay") {
        // delay is shown on the connector; skip a full node
      } else if (s.type === "condition") {
        html += node("cond", "Condition", "🔀 " + (s.label || s.cond), "Only continues if this is true.", null);
      } else {
        var priceTag = s.price > 0 ? '<span class="flow__delay">$' + s.price + ' unlock</span>' : "";
        html += node("msg", "Message " + msgNumber(a, i), window.Scheduler.esc(s.text), null, priceTag);
      }
    });
    html += '</div>';
    return html;
  }
  function msgNumber(a, upto) {
    var n = 0;
    for (var i = 0; i <= upto; i++) if (a.steps[i].type === "message") n++;
    return n;
  }
  function node(kind, label, body, sub, extra) {
    var cls = kind === "trigger" ? "flow__node--trigger" : kind === "cond" ? "flow__node--cond" : "";
    return '' +
      '<div class="flow__node ' + cls + '">' +
      '  <div class="flow__nodetop"><span class="flow__kind">' + label + '</span>' + (extra || "") + '</div>' +
      '  <div class="flow__body">' + body + (sub ? ' <span class="muted small">' + sub + '</span>' : "") + '</div>' +
      '</div>';
  }
  function connector(step) {
    var label = "";
    if (step && step.type === "delay") label = '<div class="flow__connector-label">⏱ ' + D.fmtDelay(step.delay) + '</div>';
    return '<div class="flow__connector"></div>' + label + (label ? '<div class="flow__connector"></div>' : "");
  }

  window.Automations = {
    MAX_STEPS: MAX_STEPS,
    createFlow: createFlow,
    defaultSteps: defaultSteps,
    findFlow: findFlow,
    toggleFlow: toggleFlow,
    deleteFlow: deleteFlow,
    addStep: addStep,
    activeCount: activeCount,
    renderPanel: renderPanel,
    flowHTML: flowHTML
  };
})();
