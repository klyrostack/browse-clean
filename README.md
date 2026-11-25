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
* **Session Replay & DOM Spy Neutralizer (DLP)**: Stubs and neutralizes Hotjar, FullStory, LogRocket, Clarity, and keystroke surveillance recorders to stop unauthorized corporate data harvesting.
* **Anti-Tamper & Form DLP Shield**: Shields sensitive credential and payment input fields from unauthorized script harvesting, and isolates DOM prototypes against malicious poisoning.
* **WebRTC Private LAN IP Leak Shield (Zero-Trust Network Defense)**: Dual-layer zero-trust architecture combining Chromium socket-level policy (`default_public_interface_only`) with in-page SDP and RTCPeerConnection virtualization to completely block internal LAN IP leaks (RFC 1918, RFC 3927, RFC 4193), carrier-grade NAT discovery, and VPN bypass deanonymization.
* **Homoglyph & Punycode Phishing Detector**: Detects deceptive IDN Punycode domains, mixed-script homoglyphs, and lookalike brand impersonation, rendering an active security warning barrier.
* **Bidirectional Clipboard DLP & Watermark Sanitizer**: Scrubs invisible zero-width tracking watermarks from copied text and shields high-risk API keys from clipboard siphoning.
* **Cryptographic Audit Logging (Native Web Crypto API)**: Maintains an on-device, sequential SHA-256 hash-chained ledger powered by `crypto.subtle.digest('SHA-256')`. Each intervention block binds to the preceding block's hash, enabling client-side mathematical verification of zero tampering or record deletion, exportable as signed JSON and CSV compliance packages.
* **Pre-Paint Execution & Performance Architecture (Zero-FOUC)**: Declarative CSS injection at document_start paired with CSS layout containment (contain: strict, content-visibility: hidden) and synchronous microtask bootstrapping to eliminate Flash of Unstyled Content (FOUC), layout thrashing, and Cumulative Layout Shift (CLS = 0.00).
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
| `privacy` | Enforces `chrome.privacy.network.webRTCIPHandlingPolicy` (`default_public_interface_only`) to block internal LAN IP leakage at the browser socket level. |

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
* Any standard module key (`blockCookies`, `blockNewsletters`, `blockChats`, `restoreScroll`, `stopAutoplay`, `blockNotifications`, `blockSurveys`, `unblurContent`, `unlockCopy`, `cleanUrls`, `blockAntiAdblock`, `blockLoginWalls`, `reclaimViewport`, `blockSessionSpies`, `auditLogging`, `antiTamperDlp`, `blockWebRtcLeak`, `blockPhishingSpoofs`, `clipboardDlp`) enforced by enterprise policy overrides local user preferences.

### Deployment Channels

* **Windows GPO / Active Directory Registry:**
  `HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\3rdparty\extensions\<extension-id>\policy`
  (Administrative `.reg` template exportable directly from Options > Fleet Management).
* **macOS Configuration Profiles (Jamf / MDM):**
  Managed preferences payload targeting `com.google.Chrome.extensions.<extension-id>`.
* **Google Admin Console (Chrome Enterprise Core):**
  Upload `managed_schema.json` directly under **Devices > Chrome > Apps & extensions > Users & browsers** (Policy JSON payload exportable from Options > Fleet Management).

---

## Cryptographic Audit Ledger (Native Web Crypto API)

BrowseClean maintains a fully client-side, sequential cryptographic hash-chained ledger powered by the browser's native Web Crypto API (`crypto.subtle.digest('SHA-256')`).

### Mathematical Mechanics
* **Genesis Anchor**: Block sequence `#0` anchors to a fixed 64-character genesis hash (`0000000000000000000000000000000000000000000000000000000000000000`).
* **Sequential Chaining**: Each logged intervention calculates its entry digest by cryptographically binding the record payload with the preceding block's hash:
  `EntryHash = SHA256(sequence | timestamp | domain | category | action | details | prevHash)`
* **Tamper-Evident Verification**: The Options dashboard provides a mathematical integrity auditor that traverses the entire chain from Genesis to root. Any altered field, deleted record, or reordered sequence invalidates subsequent block hashes and flags the exact index of the compromised block.
* **Compliance Manifest**: Exports a structured SOC 2 / ISO 27001 compliance verification package containing the ledger root hash, sequence proofs, and cryptographic verification status with zero external network dependencies.

---

## Zero-Trust Network Defense: WebRTC Private LAN IP Leak Shield

Modern web applications can invoke WebRTC's ICE/STUN discovery mechanism to silently extract a user's internal local area network IP addresses (such as `192.168.x.x` or `10.x.x.x`), even behind corporate VPNs or commercial proxies.

BrowseClean defends against this via a **dual-layer zero-trust architecture**:

1. **Tier 1: Chromium Socket-Level Policy (`chrome.privacy.network`)**:
   - Enforces configurable socket-level policy: `default_public_interface_only` (standard) or `disable_non_proxied_udp` (strict enterprise lockdown).
   - Prohibits WebRTC sockets at Chromium's C++ network layer from binding to non-default internal interfaces, preventing RFC 1918, RFC 3927, RFC 4193, and carrier-grade NAT address disclosure across all frames and background workers.

2. **Tier 2: In-Memory SDP & RTCPeerConnection Virtualization (`engine.js`)**:
   - Strips untrusted STUN/TURN servers from connection configurations.
   - Rewrites Session Description Protocol (SDP) payloads in `createOffer()`, `createAnswer()`, `setLocalDescription()`, and `setRemoteDescription()` to remove private IP candidate lines.
   - Virtualizes all six session description getters (`localDescription`, `currentLocalDescription`, `pendingLocalDescription`, `remoteDescription`, `currentRemoteDescription`, `pendingRemoteDescription`) so direct `.sdp` reads return scrubbed payloads.
   - Intercepts `addIceCandidate()` and `RTCIceCandidate` constructor to drop private LAN candidate injections.
   - Proxies `pc.onicecandidate`, `addEventListener('icecandidate')`, and `getStats()` to scrub local candidate IP and address reports.
   - Secures dynamic `<iframe>` creation against window prototype extraction.
   - Whitelists legitimate enterprise collaboration suites (`meet.google.com`, `teams.microsoft.com`, `zoom.us`, `webex.com`, `slack.com`, `discord.com`).
   - Includes an interactive **Live WebRTC Leak Audit Simulator** in the Options dashboard to mathematically verify zero address disclosure.

---

## Pre-Paint Execution & Performance Architecture (Zero-FOUC)

A fundamental engineering challenge in content blocking and decluttering extensions is eliminating **Flash of Unstyled Content (FOUC)** and **Cumulative Layout Shift (CLS)**. Traditional extensions wait for `DOMContentLoaded` or `document_idle`, causing noticeable visual flicker, content pops, and reflow penalties.

BrowseClean solves this through a four-stage pre-paint execution pipeline:

1. **Declarative User-Agent Pre-Paint Style Layer (`cleaner.css`)**:
   Injected at `run_at: "document_start"` across all frames. Matches CSS selectors during HTML parsing before the First Contentful Paint (FCP), collapsing CMPs, modal veils, and chat bubbles with zero visible frames.

2. **CSS Layout Containment & Render Tree Isolation**:
   Suppressed containers enforce `contain: strict !important;` and `content-visibility: hidden !important;`. Chromium's Blink rendering engine completely skips layout calculations and rasterization for matching subtrees, preserving Core Web Vitals (0.00 CLS).

3. **Synchronous Pre-Paint JavaScript Bootstrap (`engine.js`)**:
   Security shields (anti-tamper prototypes, DLP form guards, WebRTC proxies, session spy stubs) execute synchronously at `document_start` before page scripts or inline `<head>` scripts can execute.

4. **Zero-Layout-Thrashing Mutation Engine**:
   DOM sweeping operates with strict read/write decoupling scheduled through `requestAnimationFrame` microtask batches, eliminating forced synchronous reflows and guaranteeing silky 60fps scrolling performance.

---

## Enterprise SIEM Ingestion & Standardized Event Schemas (CEF / ECS / RFC 5424)

BrowseClean bridges client-side endpoint defense with enterprise Security Operations Center (SOC) pipelines by serializing cryptographic audit events into standard enterprise logging formats and streaming them to centralized SIEM ingestion collectors.

### Supported Standardized Event Schemas

1. **Elastic Common Schema (ECS 8.11 / NDJSON)**:
   - Formats intervention events into normalized JSON objects categorized under ECS taxonomy (`event.category`, `event.type`, `event.action`, `url.domain`, `service.name`, `host.name`, `hash.sha256`).
   - Supports single event JSON streaming and Newline Delimited JSON (NDJSON) batch payloads ready for direct bulk ingestion into Elasticsearch, Logstash, and Kibana dashboards.

2. **ArcSight / Splunk Common Event Format (CEF:0)**:
   - Formats events into standard pipe-delimited CEF header syntax:
     `CEF:0|BrowseClean|EndpointShield|1.1.0|<category>|<eventName>|<severity>|<extensions>`
   - Serializes security metadata including receipt timestamp (`rt`), destination host (`dhost`), action (`act`), sequence counter (`cn1`), cryptographic previous hash (`cs1`), block hash (`cs2`), and event identifiers (`externalId`).

3. **IETF RFC 5424 Syslog Protocol**:
   - Formats security logs according to the modern Syslog standard:
     `<PRI>1 TIMESTAMP HOSTNAME APP-NAME PROCID MSGID [STRUCTURED-DATA] MSG`
   - Dynamically calculates priority (`PRI`) based on `authpriv` facility (10) and threat severity (Notice, Warning, Error), encoding structured parameter sets (`[audit@53288 ...]`) for seamless ingestion into rsyslog, syslog-ng, Datadog, or Microsoft Sentinel syslog forwarders.

### Streaming Pipeline & Air-Gapped Export Suite

- **In-Memory Forwarder Queue**: Events are buffered in memory and batched according to enterprise policy (`siemBatchSize`), automatically dispatched via HTTP POST with custom authorization headers (e.g., `Splunk <HEC-TOKEN>` or `Bearer <TOKEN>`).
- **Resilient Retry Handling**: Outbound failures (network drops, HTTP 4xx/5xx) are automatically caught and retained in memory with exponential retry buffering.
- **Air-Gapped Compliance Suite**: Direct 1-click export of the active cryptographic ledger into `.ndjson`, `.cef`, and `.log` files from the Options dashboard for air-gapped forensic audits and offline SIEM ingestion.
- **Canary Heartbeat Probe**: Interactive test harness to verify SSL termination, token authorization, and ingestion pipeline reachability on demand.

---

## License

MIT © 2026 Klyrostack
