"""BarelySocial extension test harness.

Usage: python3 test_ext.py <site>    (site: instagram|youtube|reddit|linkedin|tiktok)
Opens headful Chromium with the BarelySocial extension + persistent profile.
While no .go-<site> file exists it waits so you can log in. Then it audits the
page and waits for .close-<site> to finish.
"""
import sys, os, time, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(ROOT, "extension")
PROFILE = os.path.join(ROOT, ".pw-profile")
REPORTS = os.path.join(ROOT, "reports")
LAST_VERIFIED = "2026-11-04"

SITE_URLS = {
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "reddit": "https://www.reddit.com/",
    "linkedin": "https://www.linkedin.com/feed/",
    "tiktok": "https://www.tiktok.com/",
}


def run(site: str):
    GO = os.path.join(ROOT, f".go-{site}")
    CLOSE = os.path.join(ROOT, f".close-{site}")
    url = SITE_URLS[site]
    # Google login bloquea "Chrome for Testing" de Playwright → usar el Chrome
    # REAL del sistema (canal "chrome"): UA real, sin marcas de testing.
    use_real = os.path.isdir("/Applications/Google Chrome.app")
    PROF = PROFILE + "-chrome" if use_real else PROFILE
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROF,
            channel="chrome" if use_real else None,
            headless=False,
            args=[
                f"--disable-extensions-except={EXT}",
                f"--load-extension={EXT}",
                *([] if use_real else ["--disable-blink-features=AutomationControlled"]),
            ],
            viewport={"width": 1360, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        blocked_urls, console_logs = [], []
        page.on("requestfailed", lambda r: blocked_urls.append(r.url))
        page.on(
            "console",
            lambda m: console_logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None,
        )

        page.goto(url, wait_until="domcontentloaded")
        print(f"OPEN {url}  →  log in inside the window. When finished run:\n  touch {GO}", flush=True)
        while not os.path.exists(GO):
            time.sleep(3)
        print("GO → reloading with login state…", flush=True)
        page.reload()
        try:
            page.wait_for_load_state("networkidle", timeout=30_000)
        except Exception:
            pass
        page.wait_for_timeout(6000)

        os.makedirs(REPORTS, exist_ok=True)
        shot = os.path.join(REPORTS, f"{site}-home.png")
        page.screenshot(path=shot)

        audit = page.evaluate(
            """() => {
            const vis = (el) => { if (!el || !el.offsetParent) return false;
              return getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; };
            const count = (sel) => { try {
                return [...document.querySelectorAll(sel)].filter(vis).length;
              } catch { return -1; } };
            return {
              href: location.href,
              title: document.title,
              reelsShortsLinks: count('a[href*="/reels/"], a[href*="/shorts/"]'),
              sponsoredLabels: count('[aria-label*="Sponsorent" i], [aria-label*="Sponsori" i], [aria-label*="Sponsoreado" i], [aria-label*="Patrocinado" i]'),
              suggestedInDOM: count('[aria-label*="Suggested" i], [aria-label*="sugerid" i]'),
              contentItems: count('article, [data-pos], shreddit-post'),
              overlayText: (() => {
                const o = document.querySelector('[role="dialog"]');
                return o ? (o.textContent || '').trim().slice(0, 160) : null;
              })(),
            };
        }"""
        )

        # navigation probes to blocked surfaces
        probes = {
            "instagram": "https://www.instagram.com/reels/",
            "youtube": "https://www.youtube.com/feed/trending",
            "reddit": "https://www.reddit.com/r/popular/",
            "linkedin": None,
            "tiktok": "https://www.tiktok.com/explore",
        }
        probe_url = probes.get(site)
        probe = None
        if probe_url:
            page2 = ctx.new_page()
            page2.goto(probe_url, wait_until="domcontentloaded")
            page2.wait_for_timeout(4000)
            probe_shot = os.path.join(REPORTS, f"{site}-blocked.png")
            page2.screenshot(path=probe_shot)
            probe = page2.evaluate(
                "() => ({ href: location.href, overlay: (document.querySelector('[role=\"dialog\"]')||{}).textContent?.trim().slice(0,160) || null })"
            )
            page2.close()

        report = {
            "site": site,
            "lastVerified": LAST_VERIFIED,
            "home": audit,
            "probeBlockedSurface": probe,
            "failedRequestsSample": blocked_urls[:40],
            "consoleIssues": console_logs[:40],
            "screenshots": [shot] + ([probe_shot] if probe_url else []),
        }
        with open(os.path.join(REPORTS, f"{site}.report.json"), "w") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print("REPORT →", os.path.join(REPORTS, f"{site}.report.json"), flush=True)
        print(f"Inspect the window freely. End test with:  touch {CLOSE}", flush=True)
        while not os.path.exists(CLOSE):
            time.sleep(3)
        print("closing…", flush=True)
        ctx.close()


if __name__ == "__main__":
    run(sys.argv[1])
