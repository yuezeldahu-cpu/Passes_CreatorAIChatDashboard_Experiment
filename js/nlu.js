/* ============================================================
   nlu.js — simulated natural-language understanding
   No API key, fully offline. Turns a creator's sentence into a
   structured intent + entities the chatbot can act on.
   Exposes: window.NLU
   ============================================================ */
(function () {
  "use strict";
  var D = window.PassesData;

  var WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

  function parse(raw) {
    var text = " " + (raw || "").toLowerCase().trim() + " ";
    var out = { raw: raw, intent: "fallback", entities: {}, confidence: 0.5 };

    // ---- quick navigation / info intents ----
    if (/\b(hi|hey|hello|yo|sup|what can you do|help|who are you)\b/.test(text) && !hasActionVerb(text)) {
      out.intent = "greeting"; return out;
    }
    if (/\b(show|open|see|view|go to)\b.*\b(queue|schedule|scheduled|calendar)\b/.test(text)) {
      out.intent = "show_queue"; return out;
    }
    if (/\b(show|open|see|view|list|go to)\b.*\b(automation|automations|flows?|automated messages?)\b/.test(text)) {
      out.intent = "show_automations"; return out;
    }

    // ---- entities that many intents share ----
    var ent = out.entities;
    ent.kind = detectKind(text);
    ent.audience = detectAudience(text);
    ent.time = detectTime(text);
    ent.price = detectPrice(text);
    ent.quoted = detectQuoted(raw);
    ent.topic = detectTopic(text);
    ent.trigger = detectTrigger(text);
    ent.discount = detectDiscount(text);

    // ---- automation intent ----
    // "welcome new subs", "when someone unfollows send...", "auto message when X"
    var automationSignal =
      /\b(automat|auto[- ]?message|autopilot|on autopilot|flow|when (someone|a fan|they)|welcome|win.?back|re.?engage|drip|sequence)\b/.test(text) ||
      (ent.trigger && /\b(when|whenever|every time|as soon as|after)\b/.test(text));
    if (automationSignal && ent.trigger) {
      out.intent = "create_automation";
      out.confidence = 0.9;
      return out;
    }
    if (automationSignal && !ent.trigger) {
      // they want an automation but we didn't catch the trigger
      out.intent = "create_automation";
      out.entities.trigger = null;
      out.confidence = 0.6;
      return out;
    }

    // Strong scheduling verbs. "post"/"send" are intentionally excluded here because
    // they also appear in questions ("best time to post?"), which are advisory, not commands.
    var strongSchedule = /\b(schedule|queue|drop|publish|plan|set up|put out)\b/.test(text);
    var isQuestion = /\?\s*$/.test(text) || /\b(should i|when|what time|how much|which)\b/.test(text);

    // ---- advisory intents (win over scheduling when there's no scheduling verb) ----
    if (!strongSchedule) {
      if (/\b(best|optimal|good|peak) time\b|\bwhen should i (post|send|drop)\b|\bwhat time\b/.test(text)) {
        out.intent = "suggest_time"; out.confidence = 0.85; return out;
      }
      if (/\bhow much\b|\bwhat (should i|to) (charge|price)\b|\b(pricing|price) (advice|suggestion|idea)\b/.test(text) ||
          (isQuestion && /\b(charge|price)\b/.test(text))) {
        out.intent = "suggest_price"; out.confidence = 0.8; return out;
      }
      if (/\b(caption|wording|copy|what should i say|write (me )?(a )?caption)\b/.test(text)) {
        out.intent = "generate_caption"; out.confidence = 0.75; return out;
      }
    }

    // ---- scheduling intent ----
    if ((strongSchedule || /\b(post|send)\b/.test(text)) && !/\bautomat/.test(text)) {
      out.intent = "schedule_content";
      out.confidence = 0.85;
      return out;
    }

    // if a trigger is clearly named, lean automation
    if (ent.trigger) { out.intent = "create_automation"; out.confidence = 0.6; return out; }
    // if a time is named, lean scheduling
    if (ent.time) { out.intent = "schedule_content"; out.confidence = 0.55; return out; }

    return out;
  }

  function hasActionVerb(text) {
    return /\b(schedule|post|send|automat|welcome|price|caption|queue)\b/.test(text);
  }

  /* ---------- entity detectors ---------- */
  function detectKind(text) {
    if (/\b(mass dm|dm|message|dms|direct message|inbox)\b/.test(text)) return "dm";
    if (/\b(post|feed|timeline|publish)\b/.test(text)) return "post";
    return null; // unknown -> caller defaults
  }

  function detectAudience(text) {
    var map = [
      ["vip", /\bvip|top spenders?|whales?|biggest fans?\b/],
      ["new", /\bnew subs?|new subscribers?|new fans?|newcomers?\b/],
      ["trial", /\btrial|free trial\b/],
      ["expired", /\bexpired|lapsed|cancell?ed\b/],
      ["inactive", /\binactive|quiet|gone quiet|dormant\b/],
      ["engaged", /\bengaged|active fans?|most active\b/],
      ["all", /\ball (subs?|subscribers?|fans?)|everyone\b/]
    ];
    for (var i = 0; i < map.length; i++) if (map[i][1].test(text)) return map[i][0];
    return null;
  }

  function detectTime(text) {
    // "best/optimal/peak time" -> smart
    if (/\b(best|optimal|peak|smart|prime) ?time\b|\bwhenever.*(best|active)\b|\bwhen.*most active\b/.test(text)) {
      return { type: "smart" };
    }
    if (/\btonight\b/.test(text)) return { type: "relative", dayOffset: 0, hour: 20 };
    if (/\bthis afternoon\b/.test(text)) return { type: "relative", dayOffset: 0, hour: 14 };
    if (/\bthis morning\b/.test(text)) return { type: "relative", dayOffset: 0, hour: 9 };
    if (/\btomorrow\b/.test(text)) {
      var t = { type: "relative", dayOffset: 1 };
      var hr = detectClock(text);
      if (hr != null) t.hour = hr; else t.smartHour = true;
      return t;
    }
    if (/\bthis weekend\b/.test(text)) return { type: "weekend" };
    if (/\bnext week\b/.test(text)) return { type: "relative", dayOffset: 7, smartHour: true };
    // specific weekday
    for (var name in WEEKDAYS) {
      if (new RegExp("\\b" + name + "\\b").test(text)) {
        var off = ((WEEKDAYS[name] - new Date().getDay()) + 7) % 7;
        if (off === 0) off = 7; // next occurrence
        var wd = { type: "relative", dayOffset: off };
        var c = detectClock(text);
        if (c != null) wd.hour = c; else wd.smartHour = true;
        return wd;
      }
    }
    var clock = detectClock(text);
    if (clock != null) return { type: "relative", dayOffset: 0, hour: clock };
    return null;
  }
  function detectClock(text) {
    var m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if (m) {
      var h = parseInt(m[1], 10) % 12;
      if (m[3] === "pm") h += 12;
      return h;
    }
    m = text.match(/\bat (\d{1,2})\b/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  function detectPrice(text) {
    if (/\bfor free|free\b|no charge|no price/.test(text)) return { value: 0, explicit: true };
    var m = text.match(/\$\s?(\d{1,4})/);
    if (m) return { value: parseInt(m[1], 10), explicit: true };
    m = text.match(/\bfor (\d{1,4}) ?(dollars|bucks|\$)?\b/);
    if (m && /dollar|buck|\$/.test(m[0])) return { value: parseInt(m[1], 10), explicit: true };
    if (/\b(smart|suggest|best) price|price it smart|figure out the price\b/.test(text)) return { value: null, smart: true };
    if (/\b(paid|unlock|ppv|pay.?per.?view|behind a paywall)\b/.test(text)) return { value: null, smart: true };
    return null;
  }

  function detectDiscount(text) {
    var m = text.match(/\b(\d{1,3})\s?% ?(off|discount)?\b/);
    if (m) return parseInt(m[1], 10);
    if (/\bdiscount|deal|offer|promo\b/.test(text)) return 30; // default sensible discount
    return null;
  }

  function detectQuoted(raw) {
    if (!raw) return null;
    var m = raw.match(/["“”'‘’](.+?)["“”'‘’]/);
    if (m && m[1].trim().length > 1) return m[1].trim();
    // "saying ..." / "that says ..."
    m = raw.match(/\b(?:saying|that says|message:?|caption:?)\s+(.+)$/i);
    if (m) return m[1].trim().replace(/[.]+$/, "");
    return null;
  }

  function detectTopic(text) {
    var m = text.match(/\babout (?:my |the |a |an )?([a-z0-9 ]{3,40})/);
    if (m) return m[1].trim();
    if (/\bbehind the scenes|bts|shoot\b/.test(text)) return "bts";
    if (/\bq ?& ?a|q and a|questions\b/.test(text)) return "qa";
    return null;
  }

  function detectTrigger(text) {
    // direct keyword map to trigger ids
    var rules = [
      ["new_sub", /\bnew sub|new subscriber|someone subscribes|joins?\b/],
      ["new_follower", /\bnew follower|follows? (you|me)|new follow\b/],
      ["trial_start", /\bfree trial|trial start|starts a trial\b/],
      ["trial_ending", /\btrial (ending|ends|about to end)\b/],
      ["sub_expired", /\bexpired?|subscription ends|lapsed|membership ends\b/],
      ["sub_renewed", /\brenew|renewed|renews\b/],
      ["unfollow", /\bunfollow|unfollows|cancels?|leaves?\b/],
      ["tier_upgrade", /\bupgrade|upgrades tier|higher tier\b/],
      ["first_purchase", /\bfirst (purchase|buy|unlock)\b/],
      ["big_tip", /\btip|tips|tipped|sends? money\b/],
      ["ppv_unlock", /\bppv|unlocks? a message|pay.?per.?view\b/],
      ["cart_abandon", /\babandon|didn'?t buy|opened but\b/],
      ["spend_milestone", /\bspend|spent|lifetime|milestone|big spender\b/],
      ["no_reply", /\bno reply|hasn'?t replied|stopped replying\b/],
      ["inactive_7", /\binactive (for )?(a week|7)|quiet for a week|7 days?\b/],
      ["inactive_30", /\binactive (for )?(a month|30)|quiet for a month|30 days?\b/],
      ["birthday", /\bbirthday|bday\b/],
      ["welcome_back", /\bwin.?back|comes? back|resub|re.?subscribe\b/],
      ["livestream", /\blivestream|going live|before (a )?stream\b/],
      ["keyword", /\bkeyword|types? [a-z]+ in|says? the word\b/],
      ["post_like", /\blikes? (a|my) post|likes my content\b/]
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(text)) return rules[i][0];
    return null;
  }

  window.NLU = { parse: parse };
})();
