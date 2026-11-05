# LinkedIn — Technical Notes

## What BarelySocial does here

LinkedIn is kept intentionally small: the app is a **My Network reader**, never
the algorithmic feed. What BarelySocial does here:

1. Redirect of the feed surfaces (`/`, `/feed`, `/feed/foryou`) to
   `/feed/network/` (DNR for cold navigations + SPA watcher for in-app routing).
2. Feed and rail advertising/promos removed (Promoted cards, Premium upsell,
   ad iframes).
3. Messaging junk, `/mynetwork/grow` promos and Premium job-detail cards
   removed; "People you may know" kept.
4. Advanced job filters (date, experience, employment type, remote, Easy
   Apply, title/company blocklist) on `/jobs/*`.
5. Home reflow: once the right rail is empty, the feed reclaims its columns.

Everything else — feed rewriting, junk-card cascade, whitelists of followed
handles — was implemented, tested live, and then **deliberately removed from
the codebase and from git history**.

## Design history: why it collapsed to a redirect

The full attempt (hide feed cards, separate asides, whitelist of followed
handles, cascade guards…) was defeated by three converging forces:

1. **Obfuscated, rotating facade.** LinkedIn ships atomic `fa4*` classes that
   change per deploy; the previous generation referenced
   `scaffold-finite-scroll__content`, `[data-urn]`, `[data-test-id]` — none
   exist anymore. The stable semantic anchors are text content
   (`h2 "Feed post"`, label `"Promoted"`) and `role` attributes.
2. **Cascading hides.** Hiding "the smallest block containing X" measured
   during partial renders caught page-level wrappers, collapsing the whole
   viewport to white. Only fixed, self-contained targets are hidden now, and
   never with an unbounded climb.
3. **False-positive contact surface** (e.g. "Analytics"/"Post impressions"
   links inside the user's own mini-profile rail). Every generic stamp turned
   into a fight over your own profile card — the Premium upsell hide therefore
   is bounded so it can never swallow the mini-profile.

## Final behavior (kept)

### Redirect to My Network
- **DNR rule 901**: `^https?://(?:www\.)?linkedin\.com/(?:\?.*)?$` on
  `main_frame` → `https://www.linkedin.com/feed/network/`.
- **DNR rule 902**: `/feed/foryou…` (`main_frame`) → `/feed/network/`, so the
  algorithmic feed never even loads on a cold navigation.
- **JS guard** (`sites/linkedin.js`) — surfaces only, never individual posts:
  ```js
  const isFeedSurface = (p) =>
    p === "" || p === "/" || p === "/feed" || p === "/feed/" ||
    /^\/feed\/foryou\b/.test(p);
  ```
  `/feed/update/…` (a post) is content and stays reachable.
- **SPA watcher**: the "For you" tab is a client-side route — LinkedIn calls
  `history.pushState` to `/feed/foryou/` without a network request (verified
  live). `pushState`/`replaceState`/`popstate` are wrapped and re-run `route()`.
  Without it, the redirect only worked on full reloads.

**Decision — redirect, not blank feed.** The original spec (RF5) called for
hiding the home feed entirely, News-Feed-Eradicator style. In practice a blank
page left no useful landing surface and broke expectations on refresh, so the
final behavior redirects the algorithmic surfaces to `/feed/network/` instead.
The network feed remains readable; individual posts (`/feed/update/…`) are
never touched.

### Advertising
- **Feed ads**: the ad post carries the exact label `Promoted` (or
  `Promocionado`) in its header. `hideAds()` finds it with XPath
  (`normalize-space()='Promoted'`) and hides the enclosing
  `[role="listitem"]` with `display:none` + `data-bs-hidden`. The list is
  virtualized, so the node exists even when offscreen; hiding (never removing)
  keeps React's reconciliation intact.
- **Premium upsell** (`upsellSlotId=IDENTITY_MODULE`): the `<a href>` is hidden
  immediately by CSS; JS climbs only through ancestors whose text is **exactly
  the anchor's text**, so the 74 px upsell block disappears and the
  mini-profile rail (which contains the link) can never be selected.
- **Ad iframes** (`iframe[title="advertisement"]`, dynamic ads and the Ad
  Options preview) are hidden by CSS.
- **Jobs**: the Premium applicant cards in the job detail panel — "See jobs
  where you're a top applicant" and "Get personalized tips to stand out to
  hirers" — are hidden by their leading text (bounded climb) plus the
  `JobDetails_PremiumApplicantInsights_*` slots by id. The detail panel and the
  job content are untouched.
- **Messaging**: promotional conversations are hidden from the conversation
  list (`ul[aria-label="Conversation List"] > li`) when a row carries the exact
  label `Promoted`/`Promocionado`/`Sponsored`/`Patrocinado` or LinkedIn's own
  `LinkedIn Offer` (the "Redeem my free trial" thread). InMail and real
  conversations are kept.
- **Grow page** (`/mynetwork/grow/`): the games promo ("Need a 30 second
  break? … Zip") and the "People who viewed your profile" card (analytics +
  "Unlock all with Premium") are hidden at the `main section` level. The
  "People you may know" cards and the "Suggestions for you" people list are
  **kept** — they are real people, not junk.

### Jobs: advanced filters (`/jobs/*`)
A "Filtros avanzados" pill is injected after LinkedIn's "All filters" button.
Its filter set mirrors the most-used open-source job-search projects
(`spinlud/linkedin-jobs-scraper`, `JobFunnel`):

| Control | How it is applied |
|---|---|
| Fecha (última hora / 24 h / semana / mes) | LinkedIn's native "Date posted" dropdown; "última hora" adds a local age cut |
| Experiencia (inicial → ejecutivo) | LinkedIn's native "Experience level" dropdown |
| Tipo de empleo | LinkedIn's native "Employment type" dropdown |
| Remoto | LinkedIn's native "Filter by Remote" checkbox |
| Easy Apply | LinkedIn's native "Filter by Easy Apply" checkbox |
| Excluir títulos / empresas | Client-side blocklist over rendered cards |

**Last hour**: LinkedIn has no "past hour" option and `f_TPR=r3600` is degraded
to 24 hours by the current search page (verified live: it returns jobs 6–15 h
old under a "Past 24 hours" label). So "última hora" = native 24 h filter plus
a local cut: each rendered card's "Posted N hours/minutes ago" text is parsed
(`ageMinutes`) and cards older than 60 minutes are hidden. Cards without a
parseable age (e.g. saved jobs showing "Saved · Be an early applicant") fail
open and stay visible.

Why not URL parameters: the current `/jobs/search-results/` page honors
`f_TPR` and `f_AL` but **ignores `f_WT`, `f_E` and `f_JT`** (verified live
2026-11-05), so those filters have to be driven through the page's own
controls. Dropdowns are opened by clicking the filter pill, the option is
clicked by its exact visible text (EN/ES aliases), then "Show results".

Blocklist matching uses the card's `[role="button"]` container (the direct
ancestor of the "Dismiss \<title\> job" button) and hides it with
`display:none` + `data-bs-reason="jobs-block"`. It is reversible: clearing the
list restores the cards. Values persist under the `jobs` storage key.

### Home: puzzles and responsive feed width
The "Today's puzzles" card (`#feedRightNavGamesComponentRef`) is removed by
hiding the whole rail child that contains the component (not just the inner
node), so no empty card remains. The feed grid is 24 columns: profile rail
(1–6), feed (7–16), right rail (17–24). Once the right rail is emptied, the
feed stays stuck at ~386 px and the rail keeps 304 px of blank space.
`reflowFeed()` measures the aside's visible content on the feed page and, when
empty, adds `.bs-wide-feed` to the grid; CSS then makes the feed span `7 / -1`,
so the cards grow with the viewport (386 → 714 px at 1089 px wide, 840 px at
1600 px) and the empty rail disappears. The class is removed as soon as the
aside has visible content again or the viewport drops below 1024 px (mobile
layout).
- Network-level LinkedIn ad hosts (`ads.linkedin.com`, `adg.linkedin.com`,
  `px.ads.linkedin.com`, …) are already blocked by the shared DNR ruleset.

### Intentional non-goals
- Hiding the home feed row by row (the surface is unreachable by redirect).
- "Add to your feed" suggestions and the LinkedIn Corporation footer: not
  advertising by the product definition — left visible.
- Mini-profile rail protection beyond the bounded upsell climb.

## Practical context / gotchas
- `rules/linkedin.css` holds only stable `href`/`title` anchors so the first
  paint is clean; everything text-anchored lives in `sites/linkedin.js`.
- LinkedIn's own router may normalize `feed/network` to other sub-routes
  (`/mynetwork/grow/…`) — fine: the redirect excludes its destination, so it
  never loops.
- The "For you" / "Network" tabs are two routes on the same page
  (`/feed/foryou/` and `/feed/network/`); the tab switch is `pushState`, not a
  reload. That is the reason the SPA watcher is mandatory.
- The feed list is virtualized: ad cards can be present with `height: 0` while
  offscreen. Anchor on text/role, never on geometry.
- Testing is done through **real-browser-mcp** against the logged-in profile
  (same architecture as every other surface); the history rewrite made sure
  only the final state is distributed.
