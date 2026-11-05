# TikTok — Technical Notes

## What BarelySocial does here

TikTok becomes a **messenger-first surface**: the For You feed does not
exist, the web app opens inside `/messages`, and every discovery surface
(Explore, LIVE, Shop, suggested content) is invisible. Following, search,
and intentional profile visits remain reachable.

## Architecture — redirect-first, CSS for the leftovers

| Layer | Owns |
|---|---|
| `content.js` (tiktok) | Landing redirect (`/messages`), fallback to "Following" when messaging is off |
| `rules/tiktok.css` | Hide-only pass over every discovery surface still rendered |
| `rules/dnr.json` | Network blocks for TikTok ad/analytic endpoints (`ads.tiktok.com`, `log-ads.tiktok.com`, `analytics.tiktok.com`, pixels) |

## Key technical decisions

### Messages as the landing surface
- `tiktok()` redirects anything that is not `/messages…*` to `/messages`
  **once per load** (`cfg.onlyDMs`) — for this site the messages view is the
  product surface, full stop.
- When messaging is not preferred (`onlyDMs` toggle in the popup), the
  fallback path keeps the **Following** feed reachable: the code attempts to
  click the "Siguiendo / Following" tab (or rewrites the URL to
  `/following`) so the app never resolves the For You surface first.
- The FYP becomes unreachable **by navigation** — the tab/link elements that
  lead to it are hidden in CSS as well, so no visual entry point remains.

### Hide-only rule set (constants, no config)
- `data-e2e` attribute selectors are the primary anchor — TikTok ships these
  and they are semantically named (`data-e2e="explore-tab"`,
  `data-e2e="live-*"`, `data-e2e="shop-*"`, etc.), which is far more stable
  than its internal class soup.
- Same idea drives the suggested-content hides ("People you may like",
  repost suggestions, related-content cards) and the ad/promoted deletions
  ("Sponsored"/"Promoted" labels).
- The post/compose button is **not** hidden (posting stays possible), so
  the product surface keeps creator parity. A commented-out rule exists for
  future needs (documented as the toggle-block-posting candidate) — YAGNI
  today.
- Live badges, LIVE shelves, Shop tabs and pages follow the same pattern:
  hide the entry points, not just the destination.

### Privileged exploration blocked by default
- The `webNavigation`-style URL rewiring avoids landing on `/explore` — a
  user can still visit it explicitly via the address bar, but then the CSS
  covers it anyway.

## Practical context / gotchas
- TikTok builds change `data-e2e` names occasionally; the selectors fail
  open. The maintenance pattern is identical to the IG whitelist: run over
  the surface, mark dead selectors with the build date, keep the renders.
- There is no known reliable way to enter messages without login — as in
  the other cases, real-browser testing (real-browser-mcp + real profile)
  is the verification path, not Playwright.
- Native app behavior is out of scope: TikTok's in-app feed through Safari
  shield redirection is not implemented — the extension only covers the
  `tiktok.com` surface.
