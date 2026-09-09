# Fuel — Build Plan

Status check on the current prototype (`index.html`, ~1,300 lines, built via Cowork): the visual foundation is actually solid — dark theme, mobile-sized single column, four working pages (Log / Meals / Recipes / Progress). It is not wired up to be a real daily-use app yet. Below is everything broken into chunks so we can knock them out one at a time tomorrow, roughly in order but each one is a standalone unit of work.

You said you're open to tearing it down and rebuilding fresh — my take after reading the code: **don't throw out the UI, do restructure the plumbing.** The look/feel and page layout are worth keeping. What's missing is the stuff that makes it a real app instead of a demo (persistence, real data, a settings screen, a fixed AI integration). Chunk 0 below lays out that decision explicitly so you can overrule it in the morning.

---

## Chunk 0 — Architecture decisions (read first, decide, then build)

Three open questions that affect everything downstream:

1. **Single HTML file vs. real multi-file project.**
   Right now everything — CSS, JS, markup — lives in one 1,300-line file. That's fine at this size but will get painful once we add settings, multi-day history, and PWA plumbing. Recommendation: split into `index.html` / `style.css` / `app.js` (+ a few feature modules) with no build step, so it's still just static files you can open or host anywhere. Not recommending React/Vite — adds tooling overhead this app doesn't need.

2. **API key handling.**
   The app currently calls `api.anthropic.com` directly from the browser with `anthropic-dangerous-direct-browser-calls: true`, and the key sits in `localStorage` in plaintext. That's fine if this only ever runs on your own machine. It becomes a real problem the moment you host this somewhere you might share or access from your phone over the open internet — anyone who opens dev tools can steal the key. Recommendation: keep direct-from-browser for now (fastest path to "working tomorrow"), but flag this before any public hosting — at that point we'd want a tiny backend proxy (few lines, e.g. a Cloudflare Worker) that holds the real key server-side.

3. **Where does this live / how do you use it day to day?**
   You'll be logging meals on your phone, probably away from a computer. That points toward making this an installable PWA (add to home screen, works like an app, can use the camera directly instead of the file picker) rather than a bookmarked tab. This is a moderate lift (manifest + service worker + icons) — worth doing early since it changes how we test everything else.

**My recommendation for tomorrow:** multi-file restructure (light lift), keep direct API calls for now, build toward PWA installability by the end of the week. Say the word if you'd rather just keep the single file and move faster on features instead.

---

## Chunk 1 — Fix what's actually broken

These are bugs, not features — do first regardless of architecture decision:

- `callClaudeVision` and `callClaudeMeals` both call model `claude-opus-4-6` — **this model doesn't exist.** Should be `claude-opus-4-8` or `claude-sonnet-5`. Every real (non-demo-mode) API call is currently broken.
- There is no UI to set the API key. It only works if you manually run `localStorage.setItem('fuel_api_key', '...')` in devtools. Needs a real settings field.
- `state.todayLog` and `state.exerciseLog` are in-memory only — refreshing the page wipes your whole day. Only recipes and weight entries survive reload (they're the only two saved to `localStorage`).
- The "🔥 3-day streak" in the header is hardcoded, not computed from anything.
- No day boundary logic at all — "today's log" just keeps growing forever within a session; there's no concept of "yesterday" or history.

## Chunk 2 — Real data layer (day-keyed persistence + history)

- Move everything (food log, exercise log, weights, recipes, goals, profile) into `localStorage` keyed by date, e.g. `fuel_log_2026-07-04`.
- On load, detect the current date and roll over — "today" always means today, and past days become browsable history instead of disappearing.
- Add a simple history/calendar view: tap a past day, see what you ate, total macros, whether you hit your goal.
- Compute the streak for real (consecutive days with at least one log entry, or consecutive days under/at calorie goal — decide which definition you want).
- Export/backup: a "download my data as JSON" button, since everything only lives in this browser's localStorage right now — no cloud backup at all.

## Chunk 3 — Settings & onboarding

Currently doesn't exist as a page. Needs:
- API key input (paste + save to localStorage, masked field, "test connection" button).
- Profile: age, sex, height, current weight, activity level — used to calculate a real TDEE (total daily energy expenditure) instead of you eyeballing a calorie target. Right now "1850 cal / 150g protein" are just hardcoded defaults you overwrite manually.
- Units toggle: lbs/kg, since right now weight is lbs-only.
- Dietary preferences/restrictions saved once (allergies, dislikes) instead of retyping them into the meal-generator textbox every time.

## Chunk 4 — Core logging (photo + manual + search)

- Fix the model bug (see Chunk 1) so photo analysis actually works.
- Replace/extend the hardcoded 26-item `FOOD_DB` array — either grow it manually, or hook up a real nutrition API (USDA FoodData Central is free and has an API key; Nutritionix/Open Food Facts are alternatives) for restaurant/branded food search.
- Add "recent" and "favorites" quick-add — right now every log requires photo, search, or a manual form; there's no one-tap "log the usual" for repeat meals.
- Consider a barcode scanner (camera + a lookup API) for packaged food — bigger lift, good stretch goal.

## Chunk 5 — Exercise logging

- Current MET-based calculator is reasonable as-is. Lower priority than food logging.
- Possible additions: let the "Other" custom activities you type repeatedly become quick-select buttons over time; Apple Health / Google Fit sync is a nice-to-have but a real lift (native app territory, not a web page).

## Chunk 6 — AI meal planning

- Prompt currently hardcodes "21-year-old male at 200lbs targeting 170lbs" — should pull from the real profile (Chunk 3) instead.
- Weekly meal plan mode (generate 7 days at once with a combined grocery list) instead of one-off batches of 7 individual meal ideas.
- Grocery list aggregation across multiple saved/generated meals for the week (combine "2 eggs" + "6 eggs" into one line) — right now each meal's grocery list is standalone.

## Chunk 7 — Recipe book

- Already supports save/remove/view. Add: editing a saved recipe, manually creating a custom recipe (not just AI-generated), tagging/search within the book as it grows past a handful of entries.

## Chunk 8 — Progress & goals

- Weight chart is a basic bar chart over the last 14 entries — fine for now, could become a proper line chart later.
- TDEE-based goal calculation (ties into Chunk 3 profile) instead of manually typed macro targets.
- Weekly summary view: avg calories/macros hit vs. goal, weight trend.

## Chunk 9 — PWA & mobile polish

- `manifest.json` + icons so it can be added to your phone's home screen and opens full-screen like a real app.
- Service worker for basic offline support (so logging still works with a spotty connection; syncs/analyzes when back online).
- Direct camera capture (`capture="environment"` on the file input, or `getUserMedia`) instead of only "choose from library."
- Test on an actual phone viewport, not just desktop.

## Chunk 10 — Security & hosting (once ready to use this outside your own machine)

- Decide hosting (Netlify/Vercel/GitHub Pages are all free static hosts).
- If hosted anywhere reachable from outside your own device: move the Anthropic API key server-side (small proxy function) rather than shipping it to the browser — see Chunk 0.3.

## Chunk 11 — Stretch / nice-to-haves (only after the above feels solid)

- Notifications/reminders to log meals at typical times.
- Light/dark theme toggle (currently dark-only).
- Simple gamification beyond the streak (badges, weekly wins).
- Share a logged meal or recipe as an image/text.

---

### Suggested order for tomorrow

1. Chunk 0 (decide architecture, 10-minute conversation)
2. Chunk 1 (bug fixes — quick wins, app becomes actually functional)
3. Chunk 3 (settings page — needed before anything else feels "real")
4. Chunk 2 (persistence/history — the biggest quality-of-life jump)
5. Everything else in whatever order feels most exciting to work on

---

## Timeline (target: launch Sat July 12)

Dates assume you can put in a solid working session most days — adjust freely, nothing here is a hard deadline. Since I do the actual coding, the pace is set by review/testing rounds, not typing speed.

| Phase | Dates | Chunks | Outcome |
|---|---|---|---|
| **1 — Foundation** | Sat Jul 5 | 0, 1, 3 | Architecture decided, real bugs fixed, settings page exists — app is functional with a real API key instead of demo mode |
| **2 — Data & History** | Sun Jul 6 | 2 | Daily log survives a refresh, real streak calc, browsable history, data export |
| **3 — Core feature buildout** | Mon Jul 7 – Thu Jul 10 | 4, 5, 6, 7, 8 | Logging/food-DB upgrades, exercise polish, AI meal planning improvements, editable recipe book, TDEE-based goals |
| **4 — Polish & ship (MVP launch)** | Fri Jul 11 – Sat Jul 12 | 9, 10 | Installable on your phone (PWA), hosted somewhere real, API key handled safely if public |
| **5 — Post-launch** | Sun Jul 13 onward | 11 (à la carte) | Notifications, gamification, sharing — pick off as you feel like it, not required for launch |

**Total active build time across all phases: ~12-16 hours** — heaviest days are Phase 3 (the most individual features) and Phase 4 (PWA testing on your actual phone tends to need the most back-and-forth).

---

## Budget

**API cost is the main recurring cost, and it's small.** For personal use — call it 3-5 photo meal analyses/day plus a couple of AI meal-plan generations a week — the model choice matters more than volume:

| Model | Input / Output per 1M tokens | Est. monthly cost (this app's usage) |
|---|---|---|
| Claude Sonnet 5 (recommended) | $2 / $10 intro pricing through 2026-08-31 (then $3 / $15) | **~$0.70–1.00/month** |
| Claude Opus 4.8 | $5 / $25 | ~$1.50–1.60/month |

Recommendation: **use `claude-sonnet-5`**, not the currently-hardcoded (and invalid) `claude-opus-4-6` — photo macro-estimation and meal-idea generation are exactly the kind of task Sonnet handles fine, and Opus's extra cost buys essentially nothing here. Either way, this is coffee-money, not a real budget line — even doubling usage keeps you under $3-4/month.

**Everything else is $0 for a personal app:**
- **Hosting** — Netlify/Vercel/GitHub Pages free tier comfortably covers single-user traffic.
- **Food database** — the hardcoded list works as-is; if you hook up a real API later, USDA FoodData Central is free and Nutritionix's free tier covers personal use.
- **PWA icons/manifest** — generated, no cost.
- **Domain name (optional)** — only needed if you want a custom URL instead of the free `*.netlify.app`/`*.vercel.app` subdomain; ~$12-15/year if you want one.

**Realistic total: under $2-3/month**, almost all of it the Anthropic API bill.
