# YouTube — Technical Notes

## What BarelySocial does here

YouTube becomes a **chronological subscriptions reader**: the home/feed-of
discovery does not exist, the sidebar only carries "Tú / Historial /
Suscripciones", Shorts are invisible, in-player ads get stripped, and every
surface that leads you deeper into the recommendation engine is cut.

## Architecture: redshift by layers (low → high)

| Layer | Owns |
|---|---|
| `rules/dnr.json` (DeclarativeNetRequest) | Network landing redirect + network-level ad/tracker blocks |
| `rules/youtube.css` | Static surfaces: guide sections, shorts shelves, promoted DOM bits, upnext/endscreen/cards |
| `extension/ads.js` (MAIN world, `document_start`) | Response rewriting of `/youtubei/v1/*` payloads: empties `adPlacements`, `adSlots`, `adBreaks`, `adFormats` |
| `content.js` (youtube) | Redirect enforcement + sidebar prune (text-based, markup-agnostic) |

## Key technical decisions

### The landing is never YouTube Home
- `youtube.com/` is redirected **at the DNR level** (rule on `^https?://(?:www\.)?youtube\.com/…$`,
  `main_frame`) straight to `/feed/subscriptions` — this wins the race against
  the SPA boot; a content-script redirect alone couldn't.
- The content script adds a **SPA watcher**: YouTube navigates via
  `pushState`/`replaceState` (no network request → invisible to DNR), so the
  handler re-fires on route changes; any trip back to `/` re-redirects.
- `/shorts/*` URLs redirect to `/feed/subscriptions`.

### Sidebar: only "Tú / Historial / Suscripciones"
- The old `ytd-guide-entry-renderer` markup is gone; entries are now rendered
  by a rotating facade. The prune is **text-based** (markup-agnostic): any
  `ytd-guide-entry-renderer / ytd-mini-guide-entry-renderer` whose text does
  not match the keep-list is removed, and empty `ytd-guide-section-renderer`
  wrappers + the guide footer are removed with them.
- A persistent MutationObserver re-prunes every re-render (the guide is
  re-mounted whenever the hamburger is toggled).
- CSS carries the fail-open static version of the same rule
  (`ytd-guide-section-renderer:not(:has(a[href="/feed/subscriptions"], …))`)
  so the sidebar is sane even before JS retries complete.

### Ads: layered, because YT ads live inside the player payload
1. **CSS** hides promoted renderers (`ytd-promoted-video-renderer`,
   `#player-ads`, masthead/banner promos, ad slots) — works for thumbnail ads.
2. **DNR** blocks the common ad/tracker domains scoped by
   `initiatorDomains: ["youtube.com"]` (doubleclick, googlesyndication,
   googleadservices, 2mdn, app-measurement…). Main app domains are never
   blocked.
3. **Response stripping (ads.js, MAIN world)** — the only reliable way for
   in-player ads: patch `fetch` and `XMLHttpRequest` to rewrite
   `/youtubei/v1/player|browse|next` JSON on the fly, emptying every
   `adPlacements` / `adSlots` / `adBreaks` / `adFormats` array. This is the
   technique popularized by Unhook / Simple YT AdBlocker. Fail-open: any
   error in the patch path passes the original response through.

### Chronology, not relevance
The `/feed/subscriptions` feed ships with a "Más relevantes" shelf appended
algorithmically. It is removed by an exact textContent match
(`/relevant/i` on a `ytd-rich-section-renderer`) — same pruning cycle as the
sidebar, so YouTube cannot re-append it while scrolling.

### Comments stay visible
Per spec (defaults), comments are **kept**. The rule exists in the CSS but
commented out; there is no plan to expose it as a setting (YAGNI).

## Practical context / gotchas
- Safari MV3 uses **event pages, not service workers**; the manifest declares
  `background.scripts` accordingly. ads.js must be loaded with
  `world: "MAIN"` in a separate content-script entry — the isolated world
  cannot patch page-level `fetch`/XHR.
- Watch-page session flow: after redirect storms, YT once rendered a blank
  page while hydrating — the fix was ordering: DNR redirect first, JS only
  for the SPA-race, never the other way around.
- Shorts are also blocked in search results and inside watch-page suggestion
  shelves (`ytd-reel-shelf-renderer`, `#secondary ytd-shelf-renderer`).
- Metadata: last selectors verified 2026-11-04/05; YT facades rotate per
  deploy — the text prune (keep-list) is designed to survive markup shifts.
