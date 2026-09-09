# Fuel — Public Launch Plan

**The verdict up front: you're closer to launch than it feels.** Everything a user-facing nutrition app needs is already built and tested — photo meal analysis, logging, AI meal planning, recipes, progress tracking, PWA installability. What's left is not "more features," it's "launch mechanics": closing one cost-risk gap, adding the legal boilerplate app stores require, packaging the existing app as a native app, and deciding how (if at all) it makes money. None of that is feature work — it's wrapping and paperwork around something that already works.

Decisions locked in so far: **going native** (iOS + Android, since the Apple fee is already sunk for your other app and Android is only +$25), revenue streams should be included in the plan, and you're framing this as a low-stakes "fail fast and learn" project — which shapes every recommendation below toward cheap and simple over robust and scalable.

Two assumptions I'm making that you should correct if wrong: **$0 organic marketing** (a LinkedIn post, maybe Product Hunt — no ad spend) and a **~3-4 week timeline** to a real dual-store launch. Everything below is built around those; say the word if either should change.

---

## Reality check — can this actually make money?

Straight answer: **plausibly a little, unlikely a lot — and that's worth knowing going in, not after.**

Nutrition tracking is one of the most saturated app categories that exists — MyFitnessPal, Cronometer, Lose It!, Noom, Yazio, all with years of head start and (in some cases) real marketing budgets. A generic "log your calories" app has basically no path to standing out.

But Fuel's actual hook — snap a photo, get instant macros — has a real precedent for working: **Cal AI**, a solo/small-team app doing almost exactly this, caught genuine TikTok virality and turned into real subscription revenue. That's not "any app can go viral" hand-waving — it's the same specific mechanic Fuel already has, proven to be demo-able and shareable in short-form video. So the ceiling isn't zero. It's just not guaranteed, and most attempts at this don't hit that level.

The honest way to think about it: **this is a cheap lottery ticket.** The costs below are low enough that the downside is small and bounded, the upside is real-but-unlikely, and the guaranteed return either way is the experience you carry into your next (more serious) project — exactly the frame you already had going in. Nothing here changes that; it just puts numbers on it.

### Cost breakdown

| | Amount | Notes |
|---|---|---|
| **Launch, one-time** | | |
| Apple Developer Program | $0 marginal | Already paying $99/yr for your other app — covers all your apps |
| Google Play Console | $25 one-time | Per developer account, not per app |
| Custom domain (optional) | ~$12-15/yr | Recommended for credibility (a real `.com` beats a `netlify.app` subdomain on a LinkedIn post) but not required |
| **Total to launch** | **~$25-40** | |
| **Recurring, quiet/personal-scale usage** | | |
| Claude API | ~$1-5/mo | Scales with actual photo-analysis/meal-gen volume |
| USDA API | $0 | Free tier, no realistic ceiling at this scale |
| Netlify hosting | $0 | Free tier comfortably covers low-to-moderate traffic |
| **Total, quiet** | **~$2-6/mo** | |
| **Recurring, IF it actually gets traction** | | |
| Claude API | could scale to $20s-100s+/mo | This is the real risk — usage-based, uncapped by default |
| Netlify | possibly $19/mo Pro tier | Only if bandwidth/function invocations exceed free tier — real scale needed |
| RevenueCat (if Stage 2 revenue happens) | $0 | Free until $2.5k/mo in tracked revenue |

The "if it actually gets traction" row is exactly why Phase A's spend cap and Phase E's free/Pro split both matter — they're what keep a *good* outcome (real usage) from becoming a bad one (an API bill you didn't budget for). Success without guardrails is its own risk here.

---

## Phase A — The one hard gate (do this before anything is public, PWA or native)

Right now the Claude API key lives as a single shared secret on your Netlify account. The moment *any* version of this app is reachable by the public — even just the PWA URL — anyone who finds it (or just finds the underlying function endpoint directly, without even using the app) can run up charges against **your** Anthropic bill with no limit.

Fix, in order of effort:
1. **Set a hard spend cap on your Anthropic account** (Console → usage limits). This is the non-negotiable one — 10 minutes of work, turns "unlimited exposure" into "worst case, I lose $X and the app breaks until I raise it." Set it to whatever you're comfortable losing in a worst-case month — even $10-20 is a real safety net.
2. *(Optional, cheap insurance)* Basic rate limiting on the proxy function — e.g., cap requests per IP per hour using Netlify's edge capabilities or a lightweight counter. Not required for a low-traffic fail-fast launch; worth adding if it ever gets real usage.

This is a same-day fix. Do it first, regardless of anything else below.

---

## Phase B — Legal basics (required by both app stores, good practice anyway)

Apple and Google both require a **public privacy policy URL** before they'll even review an app. Good news: Fuel's actual privacy story is unusually good and worth leading with — **almost nothing leaves the user's device.** All logs, recipes, weights, and settings live in `localStorage` on their phone; the only network calls are the specific photo/text a user chooses to send to Claude for analysis, or a food name sent to USDA for a nutrition lookup. No accounts, no tracking, no analytics (unless you add some later), no data broker anywhere.

Two documents to draft (I can write both — they're static content, not app logic):
- **Privacy Policy** — what's collected (per above: almost nothing, and what little touches a network is explained), how the Claude/USDA API calls work, no data sold/shared, contact info.
- **Terms of Use** — standard "not medical advice, macro estimates are approximate, use at your own discretion" disclaimer (normal boilerplate for any nutrition-adjacent app; keeps you legally comfortable, not a big lift).

Both can be simple pages hosted alongside the app (e.g., `privacy.html` / `terms.html` in the same Netlify deploy) — no separate infrastructure needed.

---

## Phase C — Two-track launch (the "ship both, staggered" idea, explained properly this time)

These serve two different jobs, not the same job twice:

- **Track 1 — PWA, live now.** Once Phase A's cost cap is set, the web app (what we already built) can go live on Netlify immediately. This is the version *you* use starting this week, and the version you can hand a friend or two as a private beta while the native apps are still in review. Zero waiting on anyone else's approval.
- **Track 2 — Native apps, the "official launch."** Apple and Google review submissions before they go live — typically days for Google, sometimes over a week (with possible rejection-and-resubmit) for Apple. That review clock is the thing that actually paces your timeline, not the engineering. So: build and submit the native apps in parallel with using the PWA, and treat the moment both stores approve as the actual "live on LinkedIn" moment.

Net effect: you're not blocked on Apple/Google to start using and improving the thing, but the public LinkedIn moment waits for the version that looks like a real launch (App Store badge, not a bookmarked URL).

---

## Phase D — Native app build (iOS + Android via Capacitor)

Fuel is plain HTML/CSS/JS with no framework — which means it doesn't need a rewrite to go native. **Capacitor** wraps an existing web app in a real native shell (an actual iOS/Android app, not a browser tab) with minimal changes to the app itself.

What this actually involves:
1. **Introduce Capacitor tooling** — this is the first time this project needs `npm`/`node_modules` (only for the native build process; the web app itself stays dependency-free). `npx cap add ios` / `npx cap add android` generates a real Xcode project and a real Android Studio project that just load the existing `index.html` etc.
2. **Regenerate app icons at higher resolution** — I built 512px icons for the PWA; native app stores want a 1024x1024 master (Capacitor's asset tool generates every required size from that one file automatically). Same design, just re-rendered bigger — a five-minute redo.
3. **Store listing assets** — screenshots (can be generated from the simulator/emulator or your own phone), a short description, category (Health & Fitness), age rating questionnaire. I can draft the copy; screenshots need an actual build running.
4. **Apple-side steps only you can do** (need your Apple ID / Developer account login): register the app in App Store Connect, set up signing certificates in Xcode, archive and upload the build, fill out the App Store Connect listing, submit for review. I can prep everything up to the point where Xcode needs your login.
5. **Google-side steps only you can do**: pay the one-time $25 Play Console fee, create the app listing, upload the signed build, submit for review.
6. *(Optional upgrade, not required for launch)* Once wrapped in Capacitor, the barcode scanner and camera could use Capacitor's native plugins instead of the current web-based fallback (native tends to be faster/more reliable than the browser APIs) — a nice-to-have polish pass after the initial native build works, not a blocker.

---

## Phase E — Revenue streams (staged, not all at once)

Given the "fail fast, learn a lot, breaking even would be great" framing, the right move is **the cheapest possible experiment first, bigger investment only if real usage shows up** — not building a full subscription system before a single stranger has used the app.

**Stage 1 — launch (Week 1-4): a support link, nothing else.**
A simple "☕ Support Fuel" link (Ko-fi / Buy Me a Coffee style — free to set up, no code beyond a button) in the Settings/About area. Zero infrastructure, zero payment processing to build, tests immediately whether anyone values this enough to throw a few dollars at it. Your actual variable costs are tiny (the Claude API bill is the only real recurring cost, and personal-scale usage runs ~$1-3/month per the earlier budget estimate) — a handful of $3-5 tips would already cover it.

**Stage 2 — only if it gets real, repeat usage: a free/Pro split.**
If people are actually coming back and using it, the natural monetization is capping the expensive part (AI photo analysis / meal generation) on the free tier — e.g., 3 free photo analyses a day, unlimited manual logging — with a cheap Pro unlock ($2.99-4.99/mo or a one-time unlock) for unlimited AI use. This aligns cost to revenue by construction: the users costing you real API money are the same users a paywall would ask to pay. This needs real infrastructure that doesn't exist yet — App Store/Google Play handle the actual payment, but you'd want something like RevenueCat (handles cross-platform subscriptions well, has a generous free tier) plus a lightweight backend to check entitlement status. This is a real chunk of new work — worth it only once Stage 1 shows people keep coming back.

**Stage 3 — only with real traction: affiliate/sponsor angles.**
Grocery-list integrations (affiliate links for grocery delivery or specific brands) are a soft, low-effort option if there's an audience worth monetizing that way — lowest priority, only worth revisiting if Stage 2 already shows this has legs.

Store cuts to keep in mind if Stage 2 ever happens: Apple/Google both take 15-30% of in-app purchase revenue (15% applies to you specifically once enrolled in their small-business programs, which you'd qualify for at this scale).

---

## Phase F — Marketing & growth

Building it and not marketing it gets you nowhere, agreed. Here's the actual channel-by-channel plan, cheapest and highest-leverage first. Default budget is $0 (organic only) per the assumption above — the paid tier at the end is optional, not required.

**LinkedIn (free, your home turf).**
- Post the launch from **your personal profile**, not a fresh company page — personal profiles get real organic reach, a brand-new company page with zero followers gets almost none. The post should tell the actual story: built an AI nutrition app as a fun side project, here's what it does, here's the link.
- **Also create a LinkedIn Company Page for Fuel** — takes 10 minutes, free, gives you a proper link to point to in the app/App Store listing and something to grow over time. Doesn't need to be the main reach driver on day one, just needs to exist.
- I can draft the launch post copy when we're closer to that moment.

**Free discovery channels (organic, $0, worth doing on launch day).**
- **Product Hunt** — the standard "new app" launch venue; a decent showing there can drive real first-day traffic and it's free.
- **Reddit** — relevant subreddits (r/loseit, r/SideProject, r/androidapps as examples) — check each community's self-promotion rules before posting, some are strict.
- **Hacker News "Show HN"** and **Indie Hackers** — good fit given the "solo side-project, built fast with AI" story, which is itself an interesting hook to those audiences.

**Short-form video (TikTok / YouTube Shorts) — the highest-leverage channel given the Cal AI precedent.**
- This is the one channel that's actually proven to work for this exact kind of app. The demo itself (photo → instant macros) is a natural 10-15 second hook.
- **AI-generated content is genuinely viable here**, and I can help directly with the creative side: scripts, hooks, on-screen captions, posting cadence/ideas. The actual video generation (an AI avatar/voiceover tool, or just a screen recording with trending audio in something like CapCut) needs an external tool on your end, but the writing is something I can do anytime.
- Organic reach on TikTok/Shorts rewards *volume and consistency* more than production value — a handful of rough demo clips posted regularly tends to outperform one polished video posted once.

**Paid experiment (optional — only if you want to spend a little).**
- Don't run ads before there's organic content to point them at — that's usually wasted spend. Once a few demo videos exist, a small **$100-200 total test** on Instagram/TikTok ads is enough to see if there's any signal worth scaling, without it being a real financial commitment.

---

## Timeline (assumed — flag if you want it faster/slower)

| Week | Focus |
|---|---|
| **This week** | Phase A (spend cap — do today), Phase B (privacy policy + terms), PWA goes live on Netlify. You start using the real deployed version. Start filming/collecting rough demo clips now — they take time to accumulate and cost nothing to start early. |
| **Week 1-2** | Capacitor wrapping, icon regeneration at 1024px, store listing copy drafted. You handle Apple/Google account-side registration in parallel. LinkedIn Company Page created. First TikTok/Shorts demos posted — no need to wait for the store approval to start building an audience. |
| **Week 2-3** | Builds submitted to both stores. Buffer built in for at least one rejection-and-resubmit cycle on Apple's side (very common for first submissions, nothing to worry about). Keep posting short-form content; Product Hunt/Reddit/Show HN posts drafted and ready to go. |
| **Week 3-4** | Both stores approve (or launch when the first one clears, with "Android coming soon" if one lags) → **LinkedIn personal-profile post, Product Hunt launch, Reddit/Show HN posts — the coordinated launch-day push.** Optional small paid-ads test if there's organic content performing well enough to point ads at. |
| **Ongoing after** | v0.1 shipped; iterate on a regular cadence (weekly/biweekly) based on actual usage and feedback rather than a fixed roadmap — the same philosophy as your other app. Keep posting short-form content regardless of Week 1 traction — this channel rewards consistency over time, not just launch week. |

---

## What I can start on right now, unprompted

Phase A (spend cap) needs your Anthropic Console login, but I can draft the Privacy Policy and Terms pages immediately, start the Capacitor setup groundwork, or start writing TikTok/Shorts scripts and hooks — say the word and I'll get moving on whichever piece you want first.
