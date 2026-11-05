# Privacy Policy — BarelySocial

**Last updated: 2026-11-05**

BarelySocial is a personal, non-commercial Safari/Chrome extension that removes
algorithmic feeds and advertising surfaces from social networks. It is designed
to work entirely on your device.

## Data we collect

**None.** BarelySocial has no account system, no analytics, no telemetry, no
crash reporting and no server of its own. Nothing you do is sent anywhere.

## Data stored on your device

The extension keeps a small amount of configuration in the browser's local
extension storage (`browser.storage.local`):

- `sites` — which sites are enabled and whether "DMs only" is on.
- `allowance` — daily usage counters you configure yourself.
- `following` — the list of Instagram handles read from your own "Following"
  modal, used to filter the feed.
- `jobs` — your advanced job filters (date, experience, employment type,
  blocklists).

This data never leaves your device, is not shared with the developer or any
third party, and is deleted when you uninstall the extension or clear the
extension's data.

## Network access

BarelySocial does not transmit any information. It only:

- Runs content scripts on the pages of the five supported sites
  (`instagram.com`, `youtube.com`, `reddit.com`, `linkedin.com`, `tiktok.com`)
  to hide feeds/ads and apply your filters.
- Uses the browser's Declarative Net Request API to block ad and tracking
  requests on those sites.

No page content, credentials or personal data is stored or transmitted by the
extension. To decide what to hide, the content scripts read the page's DOM
locally; that content never leaves the browser and is not persisted by
BarelySocial.

## Permissions

- `storage` — save your settings locally.
- `declarativeNetRequest` / `declarativeNetRequestWithHostAccess` — block ad and
  tracker requests on the supported sites.
- Host permissions for the five supported sites — required to run the content
  scripts that hide the unwanted surfaces.

## Third parties

None. There are no third-party SDKs, fonts, analytics or advertising services.

## Children

The extension does not collect any data from anyone, including children.

## Changes

If this policy changes, the updated version will be published at the same URL
with a new "last updated" date.

## Contact

`<YOUR-EMAIL>` — replace before publishing.

---

**Resumen en español:** BarelySocial no recopila ni envía ningún dato. Toda la
configuración se guarda localmente en tu navegador y se borra al desinstalar.
No hay analytics, servidores propios ni terceros.
