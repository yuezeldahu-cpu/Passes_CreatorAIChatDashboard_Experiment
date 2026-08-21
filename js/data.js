/* ============================================================
   data.js — mock data + shared state for the prototype
   Everything here is illustrative sample data (no real creators).
   Exposes a single global: window.PassesData
   ============================================================ */
(function () {
  "use strict";

  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* --- Engagement heatmap ---------------------------------
     engagement[dayIndex][hour] = 0..100 relative activity.
     Built with a deterministic model so "best times" are stable:
     weekday evenings (7-10pm) + lunch (12-1pm) peak, weekends shift later.
  --------------------------------------------------------- */
  function buildEngagement() {
    var grid = [];
    for (var d = 0; d < 7; d++) {
      var row = [];
      var weekend = d === 0 || d === 6;
      for (var h = 0; h < 24; h++) {
        var v = 6; // baseline
        // morning bump
        v += bump(h, weekend ? 10 : 8, 2, weekend ? 22 : 26);
        // lunch bump (weekdays stronger)
        v += bump(h, 12.5, 1.4, weekend ? 20 : 40);
        // evening prime time
        v += bump(h, weekend ? 21.5 : 20.5, 2.2, weekend ? 78 : 92);
        // late night tail
        v += bump(h, 24.5, 2.5, 30);
        // slight per-day variance (deterministic)
        v *= 0.9 + 0.03 * ((d * 7 + 3) % 6);
        row.push(Math.max(2, Math.min(100, Math.round(v))));
      }
      grid.push(row);
    }
    return grid;
  }
  function bump(h, center, width, height) {
    var x = (h - center) / width;
    return height * Math.exp(-0.5 * x * x);
  }

  var engagement = buildEngagement();

  /* Best posting windows, sorted by score (top 6). */
  function bestWindows(limit) {
    var flat = [];
    for (var d = 0; d < 7; d++) {
      for (var h = 0; h < 24; h++) {
        flat.push({ day: d, hour: h, score: engagement[d][h] });
      }
    }
    flat.sort(function (a, b) { return b.score - a.score; });
    return flat.slice(0, limit || 6);
  }

  /* Best window on a specific weekday index. */
  function bestHourForDay(dayIndex) {
    var row = engagement[dayIndex];
    var best = 0, bh = 20;
    for (var h = 6; h < 24; h++) {
      if (row[h] > best) { best = row[h]; bh = h; }
    }
    return { hour: bh, score: best };
  }

  /* --- Fan segments (for targeting) ----------------------- */
  var segments = [
    { id: "all", name: "All subscribers", size: 4820 },
    { id: "new", name: "New subscribers (7d)", size: 214 },
    { id: "vip", name: "VIP / top spenders", size: 138 },
    { id: "trial", name: "Free trial members", size: 342 },
    { id: "expired", name: "Expired subscribers", size: 671 },
    { id: "inactive", name: "Inactive 14d+", size: 903 },
    { id: "engaged", name: "Highly engaged", size: 1560 }
  ];

  /* --- Dashboard stats (4 product metrics, per time range) -
     "This Week" matches the reference screenshot (all zeros).
  --------------------------------------------------------- */
  var STAT_LABELS = ["New Profile Visits", "New Memberships", "1:1 DM Revenue", "Membership Revenue"];
  var RANGES = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "all", label: "All Time" }
  ];
  var rangeStats = {
    today: [
      { value: "8" },
      { value: "0" },
      { value: "$0.00" },
      { value: "$0.00" }
    ],
    week: [
      { value: "0" },
      { value: "0" },
      { value: "$0.00" },
      { value: "$0.00" }
    ],
    month: [
      { value: "1,284", delta: "+18%", dir: "up" },
      { value: "42", delta: "+9", dir: "up" },
      { value: "$1,320.00", delta: "+24%", dir: "up" },
      { value: "$6,940.00", delta: "+12%", dir: "up" }
    ],
    all: [
      { value: "38,510" },
      { value: "1,206" },
      { value: "$14,880.00" },
      { value: "$92,300.00" }
    ]
  };

  /* --- Automated Messages: trigger catalog (20+ triggers) -
     Grouped so the chatbot and UI can suggest the right one.
  --------------------------------------------------------- */
  var triggers = [
    // Lifecycle
    { id: "new_sub", group: "Lifecycle", icon: "👋", name: "New subscriber", desc: "A fan starts a paid subscription." },
    { id: "new_follower", group: "Lifecycle", icon: "➕", name: "New follower", desc: "Someone follows your page for free." },
    { id: "trial_start", group: "Lifecycle", icon: "🎟️", name: "Free trial started", desc: "A fan begins a free trial." },
    { id: "trial_ending", group: "Lifecycle", icon: "⏳", name: "Trial ending soon", desc: "A free trial is about to end." },
    { id: "sub_renewed", group: "Lifecycle", icon: "🔁", name: "Subscription renewed", desc: "A fan's membership renews." },
    { id: "sub_expired", group: "Lifecycle", icon: "🕰️", name: "Subscription expired", desc: "A membership lapses." },
    { id: "unfollow", group: "Lifecycle", icon: "👋", name: "Unfollows you", desc: "A fan unfollows or cancels." },
    { id: "tier_upgrade", group: "Lifecycle", icon: "⭐", name: "Upgraded tier", desc: "A fan moves to a higher tier." },
    { id: "tier_downgrade", group: "Lifecycle", icon: "↘️", name: "Downgraded tier", desc: "A fan moves to a lower tier." },
    // Revenue
    { id: "first_purchase", group: "Revenue", icon: "🛍️", name: "First purchase", desc: "A fan's first paid unlock." },
    { id: "big_tip", group: "Revenue", icon: "💸", name: "Tip received", desc: "A fan sends a tip." },
    { id: "ppv_unlock", group: "Revenue", icon: "🔓", name: "PPV unlocked", desc: "A pay-per-view message is unlocked." },
    { id: "cart_abandon", group: "Revenue", icon: "🛒", name: "Abandoned unlock", desc: "A fan opened but didn't buy a PPV." },
    { id: "spend_milestone", group: "Revenue", icon: "🏆", name: "Spend milestone", desc: "A fan crosses a lifetime spend threshold." },
    // Engagement
    { id: "no_reply", group: "Engagement", icon: "💬", name: "No reply in 48h", desc: "A fan hasn't replied recently." },
    { id: "inactive_7", group: "Engagement", icon: "😴", name: "Inactive 7 days", desc: "A fan has gone quiet for a week." },
    { id: "inactive_30", group: "Engagement", icon: "🌙", name: "Inactive 30 days", desc: "A fan has gone quiet for a month." },
    { id: "birthday", group: "Engagement", icon: "🎂", name: "Fan birthday", desc: "It's a fan's birthday." },
    { id: "welcome_back", group: "Engagement", icon: "🎉", name: "Win-back / resubscribe", desc: "A lapsed fan comes back." },
    { id: "livestream", group: "Engagement", icon: "📺", name: "Before livestream", desc: "You're about to go live." },
    { id: "keyword", group: "Engagement", icon: "🔎", name: "Keyword in message", desc: "A fan messages a keyword you set." },
    { id: "post_like", group: "Engagement", icon: "❤️", name: "Liked a post", desc: "A fan likes one of your posts." }
  ];

  function triggerById(id) {
    for (var i = 0; i < triggers.length; i++) if (triggers[i].id === id) return triggers[i];
    return null;
  }

  /* --- Seed: scheduled queue ------------------------------ */
  // times are stored as JS Date; kept relative to "now" so the demo always looks live.
  function daysFromNow(n, hour, min) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hour, min || 0, 0, 0);
    return d;
  }

  var queue = [
    {
      id: uid(), kind: "post", status: "scheduled",
      when: daysFromNow(0, 20, 30),
      text: "Behind the scenes from today's shoot 📸 dropping the full set this weekend. who's ready?",
      audience: "all", price: 0, source: "manual",
      smart: { time: true, caption: false, price: false }
    },
    {
      id: uid(), kind: "dm", status: "scheduled",
      when: daysFromNow(1, 21, 0),
      text: "hey {{name}} 💌 made something just for you. unlock to see the full thing 👀",
      audience: "engaged", price: 12, source: "smart",
      smart: { time: true, caption: true, price: true }
    },
    {
      id: uid(), kind: "post", status: "scheduled",
      when: daysFromNow(3, 12, 30),
      text: "lunch break Q&A 🍜 drop your questions below and I'll answer my faves tonight.",
      audience: "all", price: 0, source: "smart",
      smart: { time: true, caption: true, price: false }
    }
  ];

  /* --- Action items: top DMs to reuse + retention watch --- */
  var topDMs = [
    { emoji: "💋", text: "unlocked something special just for you 👀", lastUsed: "Jul 10, 2025", conv: 75 },
    { emoji: "🔥", text: "my favorite set yet... you in? 🙈", lastUsed: "Jul 10, 2025", conv: 67 },
    { emoji: "🎁", text: "lil gift inside, don't tell anyone 🤫", lastUsed: "Mar 24, 2026", conv: 14 }
  ];
  var whale = { name: "Jordan M.", days: 12, spend: "$2,410" };
  var retention = { cancelled: 3, expiringSoon: 7 };

  /* --- Seed: automation flows ----------------------------- */
  var automations = [
    {
      id: uid(),
      name: "Welcome new subscribers",
      trigger: "new_sub",
      status: "active",
      sent: 214, conv: "31%",
      steps: [
        { type: "message", delay: 0, text: "hey {{name}}! so hyped you're here 🥹 welcome to the inner circle. this is where I post the stuff I don't put anywhere else." },
        { type: "delay", delay: 60 },
        { type: "message", delay: 0, text: "quick heads up: reply anytime, I actually read these 💬 what made you join?" },
        { type: "condition", delay: 0, cond: "no_purchase_yet", label: "If no purchase after 24h" },
        { type: "delay", delay: 1440 },
        { type: "message", delay: 0, price: 9, text: "since you're new, here's a lil welcome gift 🎁 unlock for 30% off my most-loved set 👀" }
      ]
    },
    {
      id: uid(),
      name: "Win back expired subs",
      trigger: "sub_expired",
      status: "active",
      sent: 671, conv: "18%",
      steps: [
        { type: "delay", delay: 2880 },
        { type: "message", delay: 0, text: "miss you already {{name}} 🥺 the page has been popping off. come back and I'll make it worth it." },
        { type: "delay", delay: 4320 },
        { type: "message", delay: 0, price: 0, text: "ok here's the deal: resubscribe this week and your first month is 40% off. link's in your inbox 💌" }
      ]
    },
    {
      id: uid(),
      name: "Unfollows You",
      trigger: "unfollow",
      status: "paused",
      sent: 129, conv: "9%",
      steps: [
        { type: "message", delay: 0, text: "aw you're heading out 😢 no hard feelings. if it was the price, reply 'stay' for something special." },
        { type: "condition", delay: 0, cond: "replied_stay", label: "If they reply 'stay'" },
        { type: "message", delay: 0, price: 0, text: "you said the magic word ✨ here's 50% off to keep you around. we're not done yet 💪" }
      ]
    }
  ];

  /* --- utilities ------------------------------------------ */
  function uid() {
    // deterministic-ish unique id without Date.now/Math.random (blocked in some envs)
    uid._c = (uid._c || 0) + 1;
    return "id_" + uid._c + "_" + (uid._c * 2654435761 % 100000).toString(36);
  }

  function fmtHour(h) {
    var ap = h < 12 || h === 24 ? "am" : "pm";
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ap;
  }
  function fmtHourMin(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? "AM" : "PM";
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ":" + (m < 10 ? "0" + m : m) + " " + ap;
  }
  function fmtDelay(mins) {
    if (mins <= 0) return "immediately";
    if (mins < 60) return "wait " + mins + " min";
    if (mins < 1440) { var h = Math.round(mins / 60); return "wait " + h + " hour" + (h > 1 ? "s" : ""); }
    var d = Math.round(mins / 1440); return "wait " + d + " day" + (d > 1 ? "s" : "");
  }

  window.PassesData = {
    DAYS: DAYS,
    engagement: engagement,
    bestWindows: bestWindows,
    bestHourForDay: bestHourForDay,
    segments: segments,
    topDMs: topDMs,
    whale: whale,
    retention: retention,
    STAT_LABELS: STAT_LABELS,
    RANGES: RANGES,
    rangeStats: rangeStats,
    triggers: triggers,
    triggerById: triggerById,
    queue: queue,
    automations: automations,
    uid: uid,
    daysFromNow: daysFromNow,
    fmtHour: fmtHour,
    fmtHourMin: fmtHourMin,
    fmtDelay: fmtDelay
  };
})();
