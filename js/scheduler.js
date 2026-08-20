/* ============================================================
   scheduler.js — Smart Scheduler engine + UI
   - optimal-time analysis (from engagement heatmap)
   - smart pricing suggestions
   - AI caption generation (voice-matched, brand-safe)
   - visual queue: review / edit / cancel, for Posts and Mass DMs
   Exposes: window.Scheduler
   ============================================================ */
(function () {
  "use strict";
  var D = window.PassesData;

  /* ---------- SMART TIME ---------- */
  // Returns the next best Date for a post/dm, optionally anchored to a day offset.
  function suggestTime(opts) {
    opts = opts || {};
    var now = new Date();
    // If a specific day offset is requested, pick best hour that day.
    if (typeof opts.dayOffset === "number") {
      var target = new Date();
      target.setDate(target.getDate() + opts.dayOffset);
      var best = D.bestHourForDay(target.getDay());
      target.setHours(best.hour, roundMin(best.score), 0, 0);
      return target;
    }
    // Otherwise scan the next 7 days for the highest-scoring window still in the future.
    var windows = D.bestWindows(24);
    var candidates = [];
    for (var off = 0; off < 7; off++) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        var dt = new Date();
        dt.setDate(dt.getDate() + off);
        if (dt.getDay() !== w.day) continue;
        dt.setHours(w.hour, roundMin(w.score), 0, 0);
        if (dt.getTime() > now.getTime() + 30 * 60000) {
          candidates.push({ dt: dt, score: w.score });
        }
      }
    }
    candidates.sort(function (a, b) {
      // prefer sooner among the very top scores
      var s = b.score - a.score;
      if (Math.abs(s) > 6) return s;
      return a.dt - b.dt;
    });
    return candidates.length ? candidates[0].dt : D.daysFromNow(1, 20, 30);
  }
  function roundMin(score) { return (Math.round(score) % 4) * 15; } // deterministic minute

  function scoreForTime(dt) {
    return D.engagement[dt.getDay()][dt.getHours()];
  }
  function timeQuality(dt) {
    var s = scoreForTime(dt);
    if (s >= 75) return { label: "Peak window", cls: "up" };
    if (s >= 45) return { label: "Strong window", cls: "up" };
    if (s >= 25) return { label: "Okay window", cls: "flat" };
    return { label: "Quiet window", cls: "down" };
  }

  /* ---------- SMART PRICING ---------- */
  // Suggests a price range for a paid post/DM based on audience + type.
  function suggestPrice(opts) {
    opts = opts || {};
    var base = opts.kind === "dm" ? 12 : 9;
    var seg = opts.audience || "all";
    var mult = { vip: 2.4, engaged: 1.3, all: 1, new: 0.8, trial: 0.7, expired: 0.6, inactive: 0.6 }[seg] || 1;
    var mid = Math.round(base * mult);
    var low = Math.max(3, Math.round(mid * 0.7));
    var high = Math.round(mid * 1.6);
    return { low: low, mid: mid, high: high };
  }

  /* ---------- AI CAPTIONS (voice-matched, no em dashes) ---------- */
  // Lightweight templated generator that reflects the creator's casual voice.
  var CAPTION_BANK = {
    post: {
      bts: ["behind the scenes from today 📸 this one's a vibe. full set coming soon 👀",
            "little peek at what I've been working on 🎬 you're gonna want to see the rest.",
            "shot something new today and I can't stop looking at it 🫠 dropping soon."],
      teaser: ["made something just for you 💌 you're not ready for this one.",
               "ok this might be my favorite thing I've posted 🙈 unlock and tell me I'm wrong.",
               "new drop 🔥 saved the best part behind the paywall, obviously 😏"],
      qa: ["Q&A time 💬 drop your questions and I'll answer my faves tonight.",
           "ask me anything 👀 I'm in a sharing mood today.",
           "let's chat 🗣️ what do you actually want to know about me?"],
      hype: ["big things coming this week 🚀 stay close, you don't want to miss it.",
             "something special is dropping soon ✨ turn your notifs on 🔔",
             "trust me, you'll want to be here for what's next 👀"]
    },
    dm: {
      teaser: ["hey {{name}} 💌 made something just for you. unlock to see the full thing 👀",
               "{{name}}... I've been saving this one for you 🙈 wanna see?",
               "thinking about you {{name}} 😌 sent something your way, go check 👀"],
      winback: ["miss you {{name}} 🥺 the page has been popping off, come see what you missed.",
                "hey {{name}}, it's not the same without you 💔 here's a lil something to come back to."],
      welcome: ["welcome {{name}}! 🥹 so glad you're here. this is where the good stuff lives.",
                "hey {{name}}! 👋 you just made a great decision. let me show you around 💫"]
    }
  };

  function generateCaption(opts) {
    opts = opts || {};
    var kind = opts.kind === "dm" ? "dm" : "post";
    var topic = opts.topic || pickTopic(opts.text, kind);
    var bank = CAPTION_BANK[kind][topic] || CAPTION_BANK[kind].teaser || CAPTION_BANK.post.hype;
    // deterministic pick; a rotating nonce lets "new caption" cycle without Math.random
    var nonce = typeof opts.nonce === "number" ? opts.nonce : D.queue.length;
    var idx = (nonce + topic.length) % bank.length;
    return bank[idx];
  }
  function pickTopic(text, kind) {
    text = (text || "").toLowerCase();
    if (/q ?& ?a|question|ask me/.test(text)) return "qa";
    if (/welcome|new here|joined/.test(text)) return kind === "dm" ? "welcome" : "hype";
    if (/miss|come back|win.?back|expired/.test(text)) return "winback";
    if (/behind|bts|shoot|set/.test(text)) return "bts";
    if (/drop|coming|soon|hype|announce/.test(text)) return "hype";
    return kind === "dm" ? "teaser" : "teaser";
  }

  /* ---------- QUEUE CRUD ---------- */
  function addToQueue(item) {
    item.id = item.id || D.uid();
    item.status = item.status || "scheduled";
    item.smart = item.smart || { time: false, caption: false, price: false };
    D.queue.push(item);
    sortQueue();
    return item;
  }
  function sortQueue() {
    D.queue.sort(function (a, b) { return a.when - b.when; });
  }
  function cancelItem(id) {
    var i = indexOf(id);
    if (i >= 0) { D.queue.splice(i, 1); return true; }
    return false;
  }
  function updateItem(id, patch) {
    var i = indexOf(id);
    if (i < 0) return null;
    for (var k in patch) if (patch.hasOwnProperty(k)) D.queue[i][k] = patch[k];
    sortQueue();
    return D.queue[i];
  }
  function indexOf(id) {
    for (var i = 0; i < D.queue.length; i++) if (D.queue[i].id === id) return i;
    return -1;
  }
  function scheduledCount() {
    return D.queue.filter(function (q) { return q.status === "scheduled"; }).length;
  }

  /* ---------- RENDERING ---------- */
  var filter = "all";

  function renderPanel(el) {
    sortQueue();
    var items = D.queue.filter(function (q) {
      return filter === "all" ? true : q.kind === filter;
    });

    var html = "";
    html += '<div class="card">';
    html += '  <div class="card__head">';
    html += '    <div><h3 class="card__title">Content queue</h3>';
    html += '    <p class="card__sub">Review, edit, or cancel anything before it goes live. Smart items were timed and priced by your copilot.</p></div>';
    html += '    <button class="btn btn--primary btn--sm" data-new-schedule>+ Schedule</button>';
    html += '  </div>';
    html += '  <div class="toolbar">';
    html += '    <div class="seg" role="tablist">';
    html += segBtn("all", "All");
    html += segBtn("post", "Posts");
    html += segBtn("dm", "Mass DMs");
    html += '    </div>';
    html += '    <span class="right small muted">' + scheduledCount() + ' scheduled</span>';
    html += '  </div>';

    if (!items.length) {
      html += '<div class="empty">Nothing queued yet. Ask your copilot: <em>"schedule a post for tomorrow at the best time."</em></div>';
    } else {
      html += '<div class="queue">';
      items.forEach(function (q) { html += queueItemHTML(q); });
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;

    // wire filter
    el.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.getAttribute("data-seg"); renderPanel(el); });
    });
    el.querySelector("[data-new-schedule]").addEventListener("click", function () {
      window.SchedulerUI.openScheduleModal();
    });
    wireQueueActions(el);
  }

  function segBtn(id, label) {
    return '<button data-seg="' + id + '" class="' + (filter === id ? "is-active" : "") + '">' + label + "</button>";
  }

  function queueItemHTML(q) {
    var d = q.when;
    var mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
    var kindPill = q.kind === "dm"
      ? '<span class="pill pill--dm">Mass DM</span>'
      : '<span class="pill pill--post">Post</span>';
    var seg = segName(q.audience);
    var quality = timeQuality(d);
    var smartBadges = "";
    if (q.smart.time) smartBadges += '<span class="pill">✦ smart time</span>';
    if (q.smart.price) smartBadges += '<span class="pill">✦ smart price</span>';
    if (q.smart.caption) smartBadges += '<span class="pill">✦ AI caption</span>';
    var priceStr = q.price > 0 ? '$' + q.price + ' unlock' : 'Free';

    return '' +
      '<div class="qitem" data-id="' + q.id + '">' +
      '  <div class="qitem__when">' +
      '    <div class="qitem__day">' + d.getDate() + '</div>' +
      '    <div class="qitem__mon">' + mon + '</div>' +
      '    <div class="qitem__time">' + D.fmtHourMin(d) + '</div>' +
      '  </div>' +
      '  <div class="qitem__body">' +
      '    <div class="qitem__meta">' + kindPill +
             '<span class="stat__delta ' + quality.cls + ' small">' + quality.label + '</span>' +
             smartBadges + '</div>' +
      '    <div class="qitem__text">' + esc(q.text) + '</div>' +
      '    <div class="qitem__sub">To ' + seg + ' &middot; ' + priceStr + '</div>' +
      '  </div>' +
      '  <div class="qitem__actions">' +
      '    <button class="btn btn--ghost btn--sm" data-act="edit">Edit</button>' +
      '    <button class="btn btn--danger btn--sm" data-act="cancel">Cancel</button>' +
      '  </div>' +
      '</div>';
  }

  function wireQueueActions(el) {
    el.querySelectorAll(".qitem").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector('[data-act="cancel"]').addEventListener("click", function () {
        cancelItem(id);
        window.App.refresh();
        window.App.toast("Removed from queue");
      });
      row.querySelector('[data-act="edit"]').addEventListener("click", function () {
        window.SchedulerUI.openScheduleModal(id);
      });
    });
  }

  function segName(id) {
    for (var i = 0; i < D.segments.length; i++) if (D.segments[i].id === id) return D.segments[i].name;
    return "All subscribers";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  window.Scheduler = {
    suggestTime: suggestTime,
    suggestPrice: suggestPrice,
    generateCaption: generateCaption,
    timeQuality: timeQuality,
    scoreForTime: scoreForTime,
    addToQueue: addToQueue,
    cancelItem: cancelItem,
    updateItem: updateItem,
    scheduledCount: scheduledCount,
    renderPanel: renderPanel,
    segName: segName,
    esc: esc
  };
})();
