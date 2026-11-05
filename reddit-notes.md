# Reddit — Technical Notes

## What BarelySocial does here

Reddit becomes **communities-you-actually-joined** only: discovery surfaces
(Popular, News, Explore, Latest, recommended posts) are gone, ads and
suggested content never render, and the feed is exactly the joined-sub
listing.

## Architecture — CSS-first, tiny JS

| Layer | Owns |
|---|---|
| `rules/reddit.css` | All hides: nav tabs, listing-algorithm sections, promoted/suggested posts, "Latest" sections |
| `sites/reddit.js` | Redirect of discovery URLs to the joined feed |

This is the **leanest target in the project**: Reddit's new UI (shreddit)
exposes stable custom elements (`shreddit-ad-post`, `faceplate-tracker`,
`[data-source="frontpage-featured"]`) which survive renderer changes far
better than class-based DOM, so the entire behavior lives in CSS.

## Key technical decisions

### Discovery surfaces are unreachable, not filtered
- Direct navigations to `/popular`, `/news`, `/explore` are **redirected to
  the home** via a `location.replace` in the content script (`reddit()`) —
  the surfaces cannot even load.
- Their **navigation tabs** are hidden via href-anchored selectors
  (`a[href*="/popular"]`, faceplate tab items), so there is no visual entry
  point left either.

### Feed = joined communities only
- Posts with recommendation markers are hidden: `[recommended]`,
  `[data-source="frontpage-featured"]`, `:has()` heuristics on
  "recommended from r/…" banners, and any "Explore/Latest" feed sections.
- Conservative approach: the hide set is attribute-driven and fails open —
  when Reddit renames attributes, content reappears rather than the page
  breaking.

### Ads
- `shreddit-ad-post` elements and promoted labels are hidden directly in
  CSS. Reddit's ad inventory ships as its own custom element, which is
  stable enough that no network-level rules were required for this site.

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
