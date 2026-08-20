# Passes Creator Dashboard · AI Copilot

An experimental prototype of an **AI chatbot on the Passes creator dashboard** that lets
creators schedule content smartly and build automated message flows from plain-language
requests. It brings the power of the **Smart Scheduler** and **Automated Messages** tools
into a single conversational copilot that sits right on the dashboard.

> Prototype only. Self-contained, no build step, no backend, no API keys. All data is
> illustrative sample data (no real creators).

## Try it

Open `index.html` in any modern browser. That's it, there is no build step.

```
open index.html      # macOS
xdg-open index.html  # Linux
```

## What the copilot can do

Type into the copilot on the right, or tap a suggestion. It understands natural language,
figures out what you want, and drives the real dashboard tools.

### Smart Scheduler (same functions as the Smart Scheduler tool)
- **Optimal timing** from an engagement heatmap of when your fans are actually online.
- **Smart pricing** suggestions based on audience segment and content type.
- **AI captions** written in the creator's voice (brand-safe, on-brand tone).
- **Visual queue** for both **Posts** and **Mass DMs**: review, edit, or cancel before it goes live.

Try:
- `Schedule a post tomorrow at the best time`
- `Send a paid mass DM to my VIPs this weekend`
- `What's the best time to post today?`
- `Write me a caption for a behind the scenes post`

### Automated Messages (same functions as the Automated Messages tool)
- **20+ triggers** across Lifecycle, Revenue, and Engagement (new subscriber, unfollows you,
  subscription expired, tip received, first purchase, birthday, inactive, going live, and more).
- **Multi-step flows up to 20 steps** with **timed delays** and **conditional logic**.
- **Flow builder / detail view** showing the trigger, delays, conditions, and messages.
- Activate, pause, or delete flows.

Try:
- `Welcome new subscribers with a 30% off deal`
- `When a fan unfollows, send a win-back message`
- `When a subscription expires, re-engage them`

## How the "AI" works

The chatbot uses a **simulated NLU** (`js/nlu.js`): a rule-based intent parser plus entity
extraction (content type, timing, audience segment, price, trigger, discount, quoted text).
It runs fully offline with no API key. The design is drop-in ready to swap for a live
Claude API call later without changing the UI or the tool layer.

## Project structure

```
index.html          Dashboard shell + copilot panel
css/styles.css      Passes brand system (Powder Blue scale, Poppins, 80/20 dark UI)
js/data.js          Mock data: engagement heatmap, segments, 20+ triggers, seeds
js/scheduler.js     Smart Scheduler engine + queue UI
js/automations.js   Automated Messages engine + flow UI
js/nlu.js           Simulated natural-language understanding
js/chatbot.js       Copilot chat UI + intent orchestration (action cards)
js/app.js           Dashboard rendering, tabs, modals, toasts, boot
```

## Design

Follows the Passes brand system: an 80/20 monochromatic dark palette anchored by the
approved Powder Blue scale, Poppins for display type, and a copilot voice that is
effortlessly sharp, supportive, and authentic (no em dashes, no SaaS-speak).
