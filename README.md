# BrowseClean

A lightweight, zero-telemetry Chrome extension (Manifest V3) that blocks cookie banners, newsletter popups, live chat widgets, and restores scroll-locks automatically.

Built with vanilla JavaScript and declarative CSS. No external dependencies, no background polling servers, and zero data collection.

---

## How It Works

BrowseClean uses a two-phase approach to handle page clutter without layout shifts:

1. **Pre-Paint CSS (`cleaner.css`)**: Injected at `document_start` across all frames. Known CMP frameworks (Sourcepoint, OneTrust, Cookiebot, Didomi) and chat widgets are hidden before the browser paints the first frame, preventing visible flash of unstyled content (FOUC).
2. **DOM Engine (`engine.js`)**: A `MutationObserver` runs on `document.documentElement` to catch dynamically injected dialogs. It dispatches synthetic pointer and click events to decline buttons (`"No, thank you"`, `"Reject all"`, `"Necessary only"`) and strips modal lock classes from `<html>` and `<body>` to keep scrolling functional.

---

## Supported Targets

* **Cookie Consent Walls (CMPs)**: Sourcepoint, OneTrust, Cookiebot, Didomi, Usercentrics, Quantcast Choice, Google Funding Choices, TrustArc, Axeptio, CookieYes, Klaro.
* **Lead-Gen & Newsletter Modals**: Klaviyo, Privy, OptinMonster, Sumo, Sleeknote, Reddit desktop app upsells.
* **Customer Chat SDKs**: Intercom, Drift, Zendesk / Zopim, Crisp, Tawk.to, HubSpot, Freshchat, Zoho SalesIQ.
* **Soft-Paywall Unblurrer**: Removes artificial CSS `filter: blur()`, height constraints, and gradient fade-out overlays on articles.
* **Anti-Adblock Wall Bypasser**: Neutralizes Admiral, BlockAdBlock, and aggressive "disable your ad blocker" detection overlays.
* **Forced Login Wall Destroyer**: Bypasses full-screen registration gates, unmasks hidden answers/reviews, and restores scrolling on Quora, Glassdoor, Pinterest, Reddit, Scribd, and SlideShare.
* **Universal Selection & Right-Click Unlocker**: Bypasses contextmenu blocking, re-enables text selection, and prevents clipboard tracking hijacking.
* **URL Tracker Cleaner**: Strips `utm_*`, `fbclid`, `gclid`, `si`, and other tracking parameters automatically when copying links.
* **Viewport Reclaim Engine**: Compresses oversized sticky navigation bars and un-sticks floating announcement ribbons and bottom promotional docks on scroll.
* **Element Zapper (Alt+Z)**: Interactive click-to-kill tool that permanently removes any element on a website and remembers it.
* **Scroll Traps**: Clears inline `overflow: hidden`, `position: fixed`, and modal lock classes (`sp-message-open`, `modal-open`, `overflow-hidden`).
* **Autoplay Media**: Pauses unprompted background video playback.

---

## Permissions Audit

BrowseClean requests the minimum permissions required to function locally:

| Permission | Purpose |
|---|---|
| `storage` | Stores user toggle preferences and domain whitelist locally on your machine via `chrome.storage.local`. |
| `activeTab` | Allows the popup to query the active tab's domain and clean state. |
| `tabs` | Updates the blocked element counter badge on the extension toolbar icon. |

The extension contains **zero** network requests (`fetch`, `XMLHttpRequest`, `WebSocket`, or analytics beacons).

---

## Installation

### Load Unpacked (Development / Manual)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/klyrostack/browse-clean.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `browse-clean` directory.

### Build Zip for Chrome Web Store

To generate a clean `.zip` archive ready for submission to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole):

```bash
zip -r browseclean-v1.0.0.zip manifest.json cleaner.css engine.js background.js popup.html popup.css popup.js options.html options.css options.js icons/
```

---

## Directory Structure

```
browse-clean/
├── manifest.json       # Manifest V3 configuration
├── managed_schema.json # Chrome Enterprise policy schema (draft-03)
├── cleaner.css        # Pre-paint stylesheet (runs at document_start)
├── engine.js          # DOM observer and smart reject clicker
├── background.js      # Service worker, managed policy resolver, telemetry
├── popup.html         # Toolbar popup interface
├── popup.css          # Minimalist dark theme styling
├── popup.js           # Active tab controller & enterprise lock handler
├── options.html       # Whitelist and custom selector dashboard
├── options.css        # Dashboard styling & managed environment badges
├── options.js         # Settings manager (hardened against DOM injection)
├── icons/             # 16px, 32px, 48px, 128px assets
├── LICENSE            # MIT License
└── README.md          # Project documentation
```

---

## Chrome Enterprise Policy Deployment

BrowseClean natively integrates with `chrome.storage.managed` via [`managed_schema.json`](managed_schema.json), allowing enterprise IT administrators to enforce organization-wide protection policies across fleet workstations.

### Supported Policy Keys

* `whitelistedDomains`: Array of mandatory corporate intranet domains (e.g. `["corp.internal", "jira.company.com"]`) that are permanently exempt from filtering.
* `forcedLockedSettings`: Array of configuration keys that end-users are strictly prohibited from toggling.
* Any standard module key (`blockCookies`, `cleanUrls`, `unlockCopy`, `blockAntiAdblock`, `reclaimViewport`) enforced by enterprise policy overrides local user preferences.

### Deployment Channels

* **Windows GPO / Active Directory Registry:**
  `HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\3rdparty\extensions\<extension-id>\policy`
* **macOS Configuration Profiles (Jamf / MDM):**
  Managed preferences payload targeting `com.google.Chrome.extensions.<extension-id>`.
* **Google Admin Console:**
  Upload `managed_schema.json` directly under **Devices > Chrome > Apps & extensions > Users & browsers**.

---

## License

MIT © 2026 Klyrostack
