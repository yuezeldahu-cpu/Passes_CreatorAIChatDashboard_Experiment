/* ============================================================
   chatbot.js — the AI copilot: chat UI + intent orchestration
   Takes NLU output and drives the Scheduler + Automations.
   Confirmations happen through inline action cards.
   Exposes: window.Chatbot
   ============================================================ */
(function () {
  "use strict";
  var D = window.PassesData;
  var S = window.Scheduler;
  var A = window.Automations;

  var log, suggest, input, form;
  var drafts = {};   // cardId -> draft payload awaiting confirmation
  var cardSeq = 0;

  var SUGGESTIONS = [
    "Schedule a post tomorrow at the best time",
    "Welcome new subscribers with a 30% off deal",
    "When a fan unfollows, send a win-back message",
    "What's the best time to post today?",
    "Write me a caption for a behind the scenes post",
    "Send a paid mass DM to my VIPs this weekend"
  ];

  function init() {
    log = document.getElementById("chatLog");
    suggest = document.getElementById("chatSuggest");
    input = document.getElementById("chatInput");
    form = document.getElementById("composer");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      input.value = "";
      handle(v);
    });

    renderSuggestions();
    // greeting
    botSay(
      "<p>Hey Ava 👋 I'm your <strong>copilot</strong>. I can schedule posts and mass DMs at the smartest times, price them, write captions, and build automated message flows.</p>" +
      "<p>Tell me what you want to do, or tap a suggestion below.</p>"
    );
  }

  function renderSuggestions() {
    suggest.innerHTML = "";
    SUGGESTIONS.forEach(function (s) {
      var b = document.createElement("button");
      b.className = "chip";
      b.textContent = s;
      b.addEventListener("click", function () { handle(s); });
      suggest.appendChild(b);
    });
  }

  /* ---------- message plumbing ---------- */
  function userSay(text) {
    var el = document.createElement("div");
    el.className = "msg msg--user";
    el.innerHTML = '<div class="msg__avatar">AR</div><div class="msg__bubble">' + S.esc(text) + "</div>";
    log.appendChild(el);
    scroll();
  }
  function botSay(html) {
    var el = document.createElement("div");
    el.className = "msg msg--bot";
    el.innerHTML = '<div class="msg__avatar">✦</div><div class="msg__bubble">' + html + "</div>";
    log.appendChild(el);
    scroll();
    return el;
  }
  function typing() {
    var el = document.createElement("div");
    el.className = "msg msg--bot";
    el.innerHTML = '<div class="msg__avatar">✦</div><div class="msg__bubble"><span class="typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(el);
    scroll();
    return el;
  }
  function scroll() { log.scrollTop = log.scrollHeight; }

  /* ---------- main handler ---------- */
  function handle(text) {
    userSay(text);
    var t = typing();
    // brief simulated "thinking" via rAF chain (no timers that break replay)
    thinkThen(function () {
      t.remove();
      route(text);
    });
  }
  function thinkThen(fn) {
    // ~2 animation frames of delay so the typing dots register, without setTimeout randomness
    var n = 0;
    (function step() {
      if (n++ < 6) return requestAnimationFrame(step);
      fn();
    })();
  }

  function route(text) {
    var res = window.NLU.parse(text);
    switch (res.intent) {
      case "greeting": return doGreeting();
      case "show_queue": return doNavigate("scheduler", "Here's your content queue 👇");
      case "show_automations": return doNavigate("automations", "Here are your automations 👇");
      case "schedule_content": return doSchedule(res.entities);
      case "create_automation": return doAutomation(res.entities);
      case "suggest_time": return doSuggestTime(res.entities);
      case "suggest_price": return doSuggestPrice(res.entities);
      case "generate_caption": return doCaption(res.entities);
      default: return doFallback();
    }
  }

  /* ---------- intents ---------- */
  function doGreeting() {
    botSay(
      "<p>I can help you with two things, on autopilot:</p>" +
      "<p><strong>Smart Scheduler</strong> · post and mass DM at peak times, with smart pricing and captions in your voice.</p>" +
      "<p><strong>Automated Messages</strong> · flows that welcome, convert, and win back fans automatically, up to 20 steps with delays and conditions.</p>" +
      "<p>Try: <code>schedule a mass DM to VIPs this weekend</code></p>"
    );
  }

  function doNavigate(tab, msg) {
    window.App.switchTab(tab);
    botSay("<p>" + msg + "</p>");
  }

  function doFallback() {
    botSay(
      "<p>I can <strong>schedule content</strong> or <strong>build an automation</strong>. A couple of ways to say it:</p>" +
      "<ul><li>“post tomorrow at the best time about my new set”</li>" +
      "<li>“when someone subscribes, welcome them with a discount”</li>" +
      "<li>“what should I charge for a mass DM to my VIPs?”</li></ul>"
    );
  }

  function doSuggestTime(ent) {
    var kind = ent.kind || "post";
    var top = D.bestWindows(4);
    var lines = top.map(function (w) {
      return "<li><strong>" + D.DAYS[w.day] + " " + D.fmtHour(w.hour) + "</strong> · " + label(w.score) + "</li>";
    }).join("");
    var next = S.suggestTime({});
    botSay(
      "<p>Based on when your fans are most active, your top windows are:</p>" +
      "<ul>" + lines + "</ul>" +
      "<p>Next best slot is <strong>" + when(next) + "</strong>. Want me to schedule a " + kind + " then?</p>"
    );
    quickChips([
      "Schedule a " + kind + " at the best time",
      "Show me the heatmap"
    ]);
  }

  function doSuggestPrice(ent) {
    var kind = ent.kind || "dm";
    var aud = ent.audience || "all";
    var p = S.suggestPrice({ kind: kind, audience: aud });
    botSay(
      "<p>For a paid " + (kind === "dm" ? "mass DM" : "post") + " to <strong>" + S.segName(aud) + "</strong>, I'd price it around <strong>$" + p.mid + "</strong>.</p>" +
      "<p>Sensible range: <code>$" + p.low + " – $" + p.high + "</code>. Higher for VIPs, lower to convert new or lapsed fans.</p>"
    );
    quickChips(["Schedule a $" + p.mid + " " + kind + " to " + aud, "Make it free instead"]);
  }

  function doCaption(ent) {
    var kind = ent.kind || "post";
    var cap = S.generateCaption({ kind: kind, topic: ent.topic, text: ent.quoted || ent.topic });
    var cap2 = S.generateCaption({ kind: kind, topic: ent.topic === "qa" ? "hype" : "qa", text: "" });
    botSay(
      "<p>Here are two in your voice:</p>" +
      "<p>1. " + S.esc(cap) + "</p>" +
      "<p>2. " + S.esc(cap2) + "</p>" +
      "<p>Want me to schedule one?</p>"
    );
    quickChips(["Schedule a " + kind + " with that caption at the best time"]);
  }

  function doSchedule(ent) {
    var kind = ent.kind || "post";
    // resolve time
    var timeInfo = resolveTime(ent.time);
    // resolve price
    var price = 0, smartPrice = false;
    if (ent.price && ent.price.explicit) price = ent.price.value;
    else if (ent.price && ent.price.smart) { price = S.suggestPrice({ kind: kind, audience: ent.audience || "all" }).mid; smartPrice = true; }
    // resolve caption
    var caption, smartCaption = false;
    if (ent.quoted) caption = ent.quoted;
    else { caption = S.generateCaption({ kind: kind, topic: ent.topic, text: ent.topic }); smartCaption = true; }

    var audience = ent.audience || (kind === "dm" ? "engaged" : "all");

    var draft = {
      kind: kind,
      status: "scheduled",
      when: timeInfo.date,
      text: caption,
      audience: audience,
      price: price,
      source: (timeInfo.smart || smartCaption || smartPrice) ? "smart" : "manual",
      smart: { time: timeInfo.smart, caption: smartCaption, price: smartPrice }
    };

    var q = S.timeQuality(draft.when);
    var intro = "<p>Got it. Here's a <strong>" + (kind === "dm" ? "mass DM" : "post") + "</strong> ready to go";
    intro += timeInfo.smart ? " at your <strong>peak window</strong>:</p>" : ":</p>";

    var cardId = "card" + (++cardSeq);
    drafts[cardId] = { type: "schedule", draft: draft };

    var rows =
      kv("When", when(draft.when) + '  ·  ' + q.label) +
      kv("Type", kind === "dm" ? "Mass DM" : "Feed post") +
      kv("Audience", S.segName(audience) + audienceSize(audience)) +
      kv("Price", price > 0 ? "$" + price + " to unlock" + (smartPrice ? "  (smart)" : "") : "Free") +
      kv("Caption", S.esc(draft.text) + (smartCaption ? '  <span class="muted small">(AI)</span>' : ""));

    var footer =
      '<button class="btn btn--primary btn--sm" data-confirm>Confirm &amp; schedule</button>' +
      '<button class="btn btn--ghost btn--sm" data-recap>New caption</button>' +
      '<button class="btn btn--ghost btn--sm" data-retime>Best time</button>';

    var el = botSay(intro + actionCard(cardId, "✦ Smart Scheduler", rows, footer, "Scheduled to your queue ✓"));
    wireScheduleCard(el, cardId);
  }

  function doAutomation(ent) {
    if (!ent.trigger) {
      botSay(
        "<p>Love it. What should kick it off? A few popular triggers:</p>"
      );
      quickChips([
        "When someone subscribes",
        "When a fan unfollows",
        "When a subscription expires",
        "When a fan sends a tip",
        "When a free trial starts"
      ]);
      return;
    }
    var trig = D.triggerById(ent.trigger);
    var steps = A.defaultSteps(trig);

    // apply discount / price hints to the last message step
    if (ent.discount || (ent.price && ent.price.explicit)) {
      var lastMsg = null;
      for (var i = steps.length - 1; i >= 0; i--) if (steps[i].type === "message") { lastMsg = steps[i]; break; }
      if (lastMsg) {
        if (ent.price && ent.price.explicit) lastMsg.price = ent.price.value;
        if (ent.discount) lastMsg.text = lastMsg.text.replace(/\d{1,3}% off/, ent.discount + "% off");
      }
    }

    var draft = {
      id: D.uid(),
      name: nameFor(trig, ent),
      trigger: trig.id,
      status: "active",
      sent: 0, conv: "0%",
      steps: steps
    };

    var msgCount = steps.filter(function (s) { return s.type === "message"; }).length;
    var condCount = steps.filter(function (s) { return s.type === "condition"; }).length;

    var cardId = "card" + (++cardSeq);
    drafts[cardId] = { type: "automation", draft: draft };

    var rows =
      kv("Trigger", trig.icon + " " + trig.name) +
      kv("Name", S.esc(draft.name)) +
      kv("Flow", steps.length + " steps · " + msgCount + " messages" + (condCount ? " · " + condCount + " condition" + (condCount > 1 ? "s" : "") : "")) +
      kv("Preview", S.esc(firstMessage(steps)));

    var footer =
      '<button class="btn btn--primary btn--sm" data-confirm>Turn it on</button>' +
      '<button class="btn btn--ghost btn--sm" data-preview>See full flow</button>';

    var el = botSay(
      "<p>Here's an automation for <strong>" + trig.name + "</strong>. It runs on autopilot:</p>" +
      actionCard(cardId, "✦ Automated Messages", rows, footer, "Automation is live ✓"),
    );
    wireAutomationCard(el, cardId);
  }

  /* ---------- card wiring ---------- */
  function wireScheduleCard(el, cardId) {
    var card = el.querySelector(".actioncard");
    card.querySelector("[data-confirm]").addEventListener("click", function () {
      var d = drafts[cardId]; if (!d) return;
      S.addToQueue(d.draft);
      markDone(card);
      window.App.refresh();
      window.App.switchTab("scheduler");
      window.App.toast("Added to your queue");
      botSay("<p>Done ✅ it's in your <strong>Smart Scheduler</strong> queue. I'll send it at " + when(d.draft.when) + ". You can edit or cancel anytime.</p>");
      delete drafts[cardId];
    });
    card.querySelector("[data-recap]").addEventListener("click", function () {
      var d = drafts[cardId]; if (!d) return;
      var prev = d.draft.text;
      d.recapN = d.recapN || 0;
      for (var tries = 0; tries < 6; tries++) {
        d.recapN++;
        var next = S.generateCaption({ kind: d.draft.kind, topic: d.draft.topic || null, nonce: d.recapN });
        if (next !== prev) { d.draft.text = next; break; }
      }
      d.draft.smart.caption = true;
      refreshDraftCard(card, cardId);
    });
    card.querySelector("[data-retime]").addEventListener("click", function () {
      var d = drafts[cardId]; if (!d) return;
      d.draft.when = S.suggestTime({});
      d.draft.smart.time = true;
      refreshDraftCard(card, cardId);
    });
  }

  function wireAutomationCard(el, cardId) {
    var card = el.querySelector(".actioncard");
    card.querySelector("[data-confirm]").addEventListener("click", function () {
      var d = drafts[cardId]; if (!d) return;
      window.PassesData.automations.unshift(d.draft);
      markDone(card);
      window.App.refresh();
      window.App.switchTab("automations");
      window.App.toast("Automation is live");
      botSay("<p>It's live 🚀 New fans hitting <strong>" + (D.triggerById(d.draft.trigger).name) + "</strong> will get this automatically. Open it anytime to tweak the steps.</p>");
      delete drafts[cardId];
    });
    card.querySelector("[data-preview]").addEventListener("click", function () {
      var d = drafts[cardId]; if (!d) return;
      window.AutomationsUI.openDraftPreview(d.draft);
    });
  }

  function refreshDraftCard(card, cardId) {
    var d = drafts[cardId]; if (!d || d.type !== "schedule") return;
    var dr = d.draft;
    var q = S.timeQuality(dr.when);
    var body = card.querySelector(".actioncard__body");
    body.innerHTML =
      kv("When", when(dr.when) + '  ·  ' + q.label) +
      kv("Type", dr.kind === "dm" ? "Mass DM" : "Feed post") +
      kv("Audience", S.segName(dr.audience) + audienceSize(dr.audience)) +
      kv("Price", dr.price > 0 ? "$" + dr.price + " to unlock" + (dr.smart.price ? "  (smart)" : "") : "Free") +
      kv("Caption", S.esc(dr.text) + (dr.smart.caption ? '  <span class="muted small">(AI)</span>' : ""));
    scroll();
  }

  function markDone(card) { card.classList.add("is-done"); }

  /* ---------- helpers ---------- */
  function resolveTime(t) {
    if (!t || t.type === "smart") return { date: S.suggestTime({}), smart: true };
    if (t.type === "weekend") {
      // next Saturday
      var off = ((6 - new Date().getDay()) + 7) % 7; if (off === 0) off = 7;
      var d = D.daysFromNow(off, 20, 30);
      return { date: d, smart: true };
    }
    if (t.type === "relative") {
      var day = t.dayOffset != null ? t.dayOffset : 0;
      if (t.smartHour) {
        var target = new Date(); target.setDate(target.getDate() + day);
        var bh = D.bestHourForDay(target.getDay());
        return { date: D.daysFromNow(day, bh.hour, 15), smart: true };
      }
      var hour = t.hour != null ? t.hour : 20;
      return { date: D.daysFromNow(day, hour, 0), smart: false };
    }
    return { date: S.suggestTime({}), smart: true };
  }

  function nameFor(trig, ent) {
    var base = {
      new_sub: "Welcome new subscribers",
      trial_start: "Convert free trials",
      sub_expired: "Win back expired subs",
      unfollow: "Save unfollowers",
      big_tip: "Thank big tippers",
      birthday: "Birthday surprise",
      inactive_7: "Re-engage quiet fans"
    }[trig.id] || (trig.name + " flow");
    return base;
  }

  function firstMessage(steps) {
    for (var i = 0; i < steps.length; i++) if (steps[i].type === "message") return steps[i].text;
    return "";
  }

  function actionCard(id, head, rows, footer, doneMsg) {
    return '' +
      '<div class="actioncard" data-card="' + id + '">' +
      '  <div class="actioncard__head">' + head + '</div>' +
      '  <div class="actioncard__body">' + rows + '</div>' +
      '  <div class="actioncard__foot">' + footer + '</div>' +
      '  <div class="actioncard__done">' + doneMsg + '</div>' +
      '</div>';
  }
  function kv(k, v) {
    return '<div class="kv"><span class="kv__k">' + k + '</span><span class="kv__v">' + v + '</span></div>';
  }
  function audienceSize(id) {
    for (var i = 0; i < D.segments.length; i++) if (D.segments[i].id === id) return '  <span class="muted small">(' + D.segments[i].size.toLocaleString() + ')</span>';
    return "";
  }
  function label(score) {
    if (score >= 75) return "🔥 peak";
    if (score >= 45) return "strong";
    if (score >= 25) return "okay";
    return "quiet";
  }
  function when(d) {
    var dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
    var today = new Date(); today.setHours(0,0,0,0);
    var that = new Date(d); that.setHours(0,0,0,0);
    var diff = Math.round((that - today) / 86400000);
    var rel = diff === 0 ? "today" : diff === 1 ? "tomorrow" : dayName;
    return rel + " at " + D.fmtHourMin(d);
  }

  function quickChips(items) {
    var wrap = document.createElement("div");
    wrap.className = "msg msg--bot";
    var inner = '<div class="msg__avatar" style="visibility:hidden">✦</div><div class="chat__suggest" style="border:none;padding:0;margin-top:-4px">';
    inner += items.map(function (s) { return '<button class="chip">' + S.esc(s) + '</button>'; }).join("");
    inner += "</div>";
    wrap.innerHTML = inner;
    log.appendChild(wrap);
    wrap.querySelectorAll(".chip").forEach(function (b, i) {
      b.addEventListener("click", function () { handle(items[i]); });
    });
    scroll();
  }

  window.Chatbot = { init: init, handle: handle };
})();
