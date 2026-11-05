#!/usr/bin/env python3
"""Quick DOM inspection: dump ancestor chain info for elements matching a visible text."""
import sys
from playwright.sync_api import sync_playwright

text = sys.argv[1] if len(sys.argv) > 1 else "Sugerencias para ti"
url = sys.argv[2] if len(sys.argv) > 2 else "https://www.instagram.com/"
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        "/Users/sobusadriver/Projects/barely-social/.pw-profile",
        headless=True,
        args=[f"--disable-extensions-except=/Users/sobusadriver/Projects/barely-social/extension",
              f"--load-extension=/Users/sobusadriver/Projects/barely-social/extension"],
        viewport={"width": 1360, "height": 900},
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(8000)
    info = page.evaluate(
        """(needle) => {
          const out = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const t = walker.currentNode.textContent.trim();
            if (t && t.toLowerCase().includes(needle.toLowerCase())) {
              let el = walker.currentNode.parentElement, depth = 0, chain = [];
              while (el && depth < 12) {
                chain.push(`${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${[...el.attributes].map(a=>'['+a.name+'='+JSON.stringify(a.value.slice(0,60))+']').join('')}`);
                el = el.parentElement; depth++;
              }
              out.append = null; out.push(chain);
              break;
            }
          }
          return JSON.stringify(out, null, 1);
        }""",
        text,
    )
    print(info)
    page.screenshot(path="/Users/sobusadriver/Projects/barely-social/reports/inspect.png")
    ctx.close()
