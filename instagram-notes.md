# Instagram — Technical Notes

## What BarelySocial does here

Instagram web is the flagship target: it turns the discovery-driven feed into a
**followers-only feed** and neutralizes every retention surface, while leaving
DMs, profiles, stories, search, and posting untouched.

## Architecture: two owners, never two

| Layer | Owns |
|---|---|
| `rules/instagram.css` | Static, always-algorithmic surfaces (Reels nav, Explore, ads badges, lives, shopping) + first-paint accent graying |
| `sites/instagram.js` | Everything dynamic: suggested posts, whitelist scrub, feed-end / empty-feed banners, accent by geometry, redirects |

**Rule learned the hard way:** CSS rules that try to hide suggested posts
overlap with the JS logic and produce false positives (hiding followed posts).
One dynamic concern = one owner (JS). CSS never "touches" cards.

## Key technical decisions

### Feed opening surface
- The home feed opens on the **"Siguiendo" (Following) tab** — enforced by a
  JS retry loop (≤5 s) that finds and clicks the tab (IG loads For You by
  default).
- The discovery feed **does not exist as a navigable surface**: Reels/Explore/
  For You redirects land on a `role="dialog"` overlay: *"Bloqueado por
  BarelySocial"*.

### Suggested posts ban (zero-tolerance)
- Mid-feed suggested posts are detected through an **exact textContent match**
  of the heading inside the injected article:
  `suggested for you / sugerencias para ti / sugerido para ti / recommended
  for you / ver más como este / see more like this`.
- **Hide, never remove.** `article.remove()` breaks Instagram's React
  reconciliation and triggers its error boundary ("Something went wrong"),
  which eats real followed posts. We set `display: none !important` +
  `data-bs-hidden` and use a **self-repair pass** that un-hides anything IG
  re-rendered into non-junk content.
- Upgrade path already used: suggested **blocks with ≥2 creators** are kept
  if at least one creator is followed (user-defined collab rule).

### Followers whitelist (final arbiter)
- The DOM does not expose "who you follow", so the extension scans the
  **profile → Following modal**: an auto-scroller walks the list to the end
  (two consecutive empty rounds), then persists the handles to
  `browser.storage.local` under `following`.
- The scraper **only persists when the scan is complete** — a partial list
  classified followed accounts as blocked (the xataka incident).
- Scrub rule: a post stays visible if ≥1 of the creator handles found in the
  **header zone only** (first ~140 px of the article) is followed. Captions /
  tagged-account mentions deeper in the post are ignored on purpose.
- Fail behavior: without a scanned list, the scrub is a no-op — heuristics
  (exact-phrase suggested detection) remain as the only filter.

### End of feed (the anti-infinite-scroll)
- Trigger #1: the first suggested insertion (Instagram's own signal that
  followed content ran out).
- Trigger #2: the user reaches the bottom of the **inner scroller**
  (`window.scrollY` stays 0 — IG scrolls inside a container).
- Both insert a pinned banner card; a `MutationObserver` pass keeps it
  re-pinned as the last child of the feed and hides any `<article>` appended
  *after* it (`data-bs-reason="post-feed-end"`).
- A `:root[data-bs-feed-end]` flag kills `role="progressbar"` loaders
  class-wide via CSS, so the skeleton loader at the tail never repaints.
- Empty-feed state: if 0 visible articles remain, a separate banner declares
  *"it's silence, not an error"* (distinct from the end-of-feed card).

### Neutral accent (grays out Meta's gradients)
- Story rings are drawn on a **`<canvas>`** — no CSS color/gradient
  match possible. Discovered by DOM walking; the answer is a geometry-first
  JS pass: small element (≤220 px) + gradient background / accent-colored
  shadow / SVG defs → `filter: grayscale(1) brightness(0.85)`.
- CSS covers the fast path (`[style*="radient" i]`, `svg:has(linearGradient)`,
  `ul canvas`) so rings are gray from the first paint; JS handles the rest
  (badges, icons) with a short-debounce MutationObserver.
- imgs/videos are force-whitelisted (`filter: none`) so content itself is
  never desaturated.

## Practical context / gotchas
- Instagram rewrites its obfuscated class surface (`x…` atomic classes)
  constantly — anything className-based is a liability. We anchor on
  `aria-label`, `href` prefixes, `role`, exact textContent.
- "Suggested para ti" panel next to the feed is anchored via the
  `a[href="/explore/people/"]` link ("See all") and hidden by climbing to a
  div sitting >55 % viewport width that contains no article.
- Multi-creator co-authored posts ("A and B") render as one article with both
  handles — the collab-keep rule depends on the whitelist being current.
- Verified recommendation: after any extension reload, visit the Following
  modal once so the whitelist is refreshed.
