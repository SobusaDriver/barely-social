# LinkedIn — Technical Notes

## What BarelySocial does here

LinkedIn is intentionally the **smallest surface** in the project: the only
behavior kept, after multiple rounds of iteration and rollback, is a
**landing redirect to My Network**. Everything else — feed hiding, junk
cards, whitelists, cascade guards — was implemented, tested live, and then
**deliberately removed from the codebase and from git history**.

## Design history: why it collapsed to a redirect

The full attempt (hide feed cards, separate asides, whitelist of followed
handles, cascade guards…) was defeated by three converging forces:

1. **Obfuscated, rotating facade.** LinkedIn now ships atomic `fa4*` classes
   that change per deploy; the previous generation referenced
   `scaffold-finite-scroll__content`, `[data-urn]`, `[data-test-id]` — none
   exist anymore. The one stable semantic anchor found was the exact-text
   `h2 "Feed post"` label per post card.
2. **Cascading hides.** Hiding "the smallest block containing X" measured
   during partial renders caught page-level wrappers, collapsing the whole
   viewport to white. The cascade guard (parent ≥ +150 px larger) fixed the
   mechanics but not the cost of keeping such logic correct across builds.
3. **False-positive contact surface** (e.g. "Analytics"/"Post impressions"
   links inside the user's own mini-profile rail) kept disputing the rules:
   every generic stamp turned into a fight over your own profile card.

Under the KISS / DRY / YAGNI pass the verdict was: **the redirect is all of
the value at ~0 % of the fragility**. Feed, promoted cards, games, puzzles —
they are all unreachable if you never land on them.

## Final behavior (kept)

### Redirect to My Network
- **DNR rule 901**: `^https?://(?:www\.)?linkedin\.com/(?:\?.*)?$` on
  `main_frame` → `https://www.linkedin.com/feed/network/`. Fires before any
  HTML, immune to SPA races.
- **JS guard** (`sites/linkedin.js`):
  ```js
  const IS_TARGET = /^\/feed\/network\/?$/.test(location.pathname);
  const NEEDS = pathname === "" || pathname === "/" ||
    (pathname.startsWith("/feed") && !IS_TARGET);
  if (NEEDS) location.replace("https://www.linkedin.com/feed/network/");
  ```
- **Anti-loop fix** (root of the one critical bug of this surface): `/feed/network/`
  itself starts with `/feed` — without the `IS_TARGET` exclusion the redirect
  re-fired against its own landing, reload-looping forever.

### Intentional non-goals (removed by the user's decision)
- Hiding the home feed row by row.
- Cards: "Today's puzzles" (`#feedRightNavGamesComponentRef`), "Add to your
  feed", Analytics/"People who viewed your profile", Premium "Get hired
  up to…" (`upsellSlotId=IDENTITY_MODULE`), "Promoted" chip cards, the
  LinkedIn Corporation footer.
- Mini-profile rail protection / auto-repair links.
- All of these selectors existed and were verified against the live DOM —
  they live in the repository history (squashed away at commit `4eb2013`).
  They can be resurrected from there if the product decision changes; the
  notes preserved the exact names for that purpose.

## Practical context / gotchas
- `rules/linkedin.css` is kept as an (almost-empty) file because the manifest
  references it; its only content is documentation pointing at this file and
  the kept redirect.
- LinkedIn's own router may internally normalize `feed/network` to other
  sub-routes (e.g. `/mynetwork/grow/…`) — that is fine: the redirect itself
  never loops because it excludes its destination.
- If LInkIn/UI classes change again, prefer semantic anchors verified from
  DevTools **on the network-request level** (the DNR list also cleaned
  trackers) before adding any hide-by-content rule; climbing logic is what
  made this surface expensive.
- Testing is done through **real-browser-mcp** against the logged-in profile
  (the same architecture working for all other surfaces); the history rewrite
  made sure only the final state is distributed.
