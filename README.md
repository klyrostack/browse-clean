# BrowseClean

> A client-side, zero-telemetry Chrome extension built on Manifest V3 designed to neutralize intrusive web patterns—including cookie consent walls (CMPs), lead-generation modals, floating support widgets, and programmatic scroll-locks.

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-3B82F6?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-zinc?style=flat-square)](#)
[![Zero Network Dependencies](https://img.shields.io/badge/Telemetry-Zero_Network-10B981?style=flat-square)](#)

---

## Technical Overview

Modern web experiences are plagued by aggressive first-party overlays that bypass standard ad-blockers: consent management platforms (Sourcepoint, OneTrust, Cookiebot), viewport-blocking email forms, customer messaging SDKs (Intercom, Drift), and arbitrary document overflow traps.

BrowseClean approaches this problem through a **dual-layer pipeline**:

1. **Declarative Pre-Paint Filter (`cleaner.css`)**
   Injected at `document_start` across all frames (`all_frames: true`). Known CMP selectors, backdrops, and floating widgets are neutralized prior to the browser's initial layout and paint phases, completely preventing layout shift (FOUC).

2. **Intent-Based Dynamic Content Engine (`engine.js`)**
   A low-overhead DOM controller running in isolated context. It evaluates document mutations via microtask-throttled `MutationObserver` on `document.documentElement`, handles cross-origin iframe consent boundaries, programmatically dispatches pointer events to multi-lingual rejection targets, and neutralizes programmatic scroll traps (`overflow: hidden`, `position: fixed`).

---

## Architectural Highlights

* **Zero Network Footprint**: Contains no network calls (`fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon`). The extension runs 100% locally with zero cloud dependencies.
* **Deterministic Rejection Dispatch**: Rather than merely hiding consent dialogs (which can trigger infinite reload loops or leave backend consent unfulfilled), the engine dispatches synthetic `PointerEvent` and `MouseEvent` sequences to authentic rejection controls (`"No, thank you"`, `"Reject all"`, `"Necessary only"`).
* **Scroll-Lock Remediation**: Automatically clears modal-associated lock classes (`sp-message-open`, `didomi-popup-open`, `modal-open`) and restores normal document scrolling without breaking native layout flow.
* **Least-Privilege Security Model**: Operates without invasive `<all_urls>` permission declarations or remote script loading, conforming strictly to the Chrome Web Store security guidelines.

---

## Core Capabilities

| Module | Mechanism |
|---|---|
| **Consent & CMPs** | Pre-paint CSS suppression coupled with multi-lingual reject dispatch (Sourcepoint, OneTrust, Cookiebot, Didomi, Usercentrics, Quantcast). |
| **Lead Generation Overlays** | Structural heuristic identification of modal dialogs containing email capture elements and high z-index backdrops. |
| **Support Chatbots** | Automated suppression of third-party live support SDKs (Intercom, Drift, Zendesk, Crisp, Tawk.to, HubSpot). |
| **Overflow Recovery** | Runtime monitoring of `<html>` and `<body>` inline overflow constraints, restoring viewport mobility. |
| **Autoplay Intervention** | Intercepts non-user-initiated video playback to reduce ambient resource consumption. |
| **Domain Whitelist & Selectors** | Client-managed allowlist for sensitive platforms (financial portals, authentication gateways) with custom CSS selector injection. |

---

## Project Structure

```
browseclean/
├── manifest.json       # Manifest V3 specification
├── cleaner.css        # Zero-FOUC declarative pre-paint stylesheet
├── engine.js          # DOM observer, heuristic evaluator, and event dispatcher
├── background.js      # Background service worker (badge counts and state store)
├── popup.html         # Minimalist extension controls
├── popup.css          # Scoped dashboard styles
├── popup.js           # Client-side state synchronization
├── options.html       # Preferences and custom selector management
├── options.css        # Settings styling
├── options.js         # Settings manager with hardened DOM insertion
└── icons/             # Multi-resolution production raster assets
```

---

## Installation & Development

### Local Deployment (Unpacked)
1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/browseclean.git
   ```
2. Navigate to `chrome://extensions/` in Google Chrome or any Chromium-based browser.
3. Enable **Developer mode** via the top-right toggle.
4. Select **Load unpacked** and choose the `browseclean` root directory.

### Production Build
To prepare a distributable archive for the Chrome Web Store:
```bash
zip -r browseclean-v1.0.0.zip manifest.json cleaner.css engine.js background.js popup.html popup.css popup.js options.html options.css options.js icons/
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
