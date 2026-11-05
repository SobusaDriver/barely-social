# Reddit — Technical Notes

## What BarelySocial does here

Reddit becomes **communities-you-actually-joined** only: discovery surfaces
(Popular, News, Explore, Latest, recommended posts) are gone, ads and
suggested content never render, and the feed is exactly the joined-sub
listing.

## Architecture — CSS-first, tiny JS

| Layer | Owns |
|---|---|
| `rules/reddit.css` | All hides: nav tabs, listing-algorithm sections, promoted/suggested posts, right-rail discovery/promos, "Latest" sections, responsive feed rules |
| `sites/reddit.js` | Redirect of discovery URLs, right-rail nav prune and the home feed reflow |

This is the **leanest target in the project**: Reddit's new UI (shreddit)
exposes stable custom elements (`shreddit-ad-post`, `faceplate-tracker`,
`[data-source="frontpage-featured"]`) which survive renderer changes far
better than class-based DOM, so almost all behavior lives in CSS.

## Key technical decisions

### Discovery surfaces are unreachable, not filtered
- Direct navigations to `/popular`, `/news`, `/explore`, `/latest` and their
  `/r/*` variants (`/r/popular`, `/r/all`, …) are **redirected to the home**
  via `location.replace` in the content script.
- Their **navigation tabs** are hidden via href-anchored selectors
  (`a[href="/popular"]`, `a[href="/r/popular"]`, faceplate tab items), so
  there is no visual entry point left either.

### Feed = joined communities only
- Posts with recommendation markers are hidden: `[recommended]`,
  `[data-source="frontpage-featured"]`, `:has()` heuristics on
  "recommended from r/…" banners, and any "Explore/Latest" feed sections.
- Conservative approach: the hide set is attribute-driven and fails open —
  when Reddit renames attributes, content reappears rather than the page
  breaking.

### Ads
- `shreddit-ad-post` elements, promoted posts and promoted comments are
  hidden directly in CSS. Reddit's ad inventory ships as its own custom
  element, which is stable enough that no network-level rules were required
  for this site.

### Right rail + responsive home
- **Home** (`/`): the rail is pure discovery/promos — "Discover communities",
  recently-viewed posts, ad slots — so it is always collapsed and the feed
  reclaims its 316 px (`717 → 1057 px` on a 1089 px viewport). This is the only
  page where the grid is forced to one column.
- **Subreddit / post pages**: `aside[aria-label="People also ask about
  section"]` and `aside[aria-label="Related Posts Section"]` (an endless list
  of other posts) are hidden, but the rail itself is kept because it carries
  `Community information` (rules, description) and its content is async —
  hiding it would unload the module and it would not come back.
- The redundant "Home / Popular / News / Explore / Best of Reddit" list that
  Reddit injects inside the rail is hidden by text (`hideRailNav`).
- CSS: `.bs-reddit-wide { grid-template-columns: minmax(0, 1fr) }` plus
  `.bs-reddit-wide > .right-sidebar { display: none }`; the class is managed
  by `sites/reddit.js` and re-evaluated on navigation/resize.

## Practical context / gotchas
- Reddit's rendering pipeline (web components + faceplate) means most class
  churn is harmless; the `shreddit-*` tags are the stability contract.
- No whitelist needed here: "joined" is a visible filter Reddit itself
  applies if the algorithmic rows are hidden, so the prune is deeper than
  IG's but does not need state.
- The page uses infinite scrolling natively; there was no need to cut it
  because once the algorithmic rows are gone, appending stops when Reddit
  has nothing more to offer the joined feed — matching the expected UX.
- Future hardening (YAGNI): hidden state could be toggled per-site from the
  popup, but Reddit has not needed it in practice.
