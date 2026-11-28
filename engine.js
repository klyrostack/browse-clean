/**
 * BrowseClean - Core Content Engine (Production Grade)
 * Ultra-fast, zero-overhead DOM declutter, consent automation,
 * anti-paywall unblurring, selection unlocker, URL sanitizer, and element zapper.
 * Injected at document_start in all frames.
 */

(function () {
  'use strict';

  // Prevent duplicate execution within the same execution context
  if (window.__browseclean_engine_active) return;
  window.__browseclean_engine_active = true;

  // Snapshot pristine native DOM and prototype methods for anti-tamper resilience
  const _nativeQuerySelector = Document.prototype.querySelector;
  const _nativeQuerySelectorAll = Document.prototype.querySelectorAll;
  const _nativeAddEventListener = EventTarget.prototype.addEventListener;
  const _nativeRemove = Element.prototype.remove;
  const _nativeSetAttribute = Element.prototype.setAttribute;

  const currentHostname = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';
  let isCleanActive = true;
  let blockedCount = 0;
  let isZapperActive = false;

  // Pre-Paint Execution & Performance Instrumentation (Zero-FOUC)
  const prepaintMetrics = {
    startTime: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
    prepaintDurationMs: 0,
    nodesSuppressedPrepaint: 0,
    foucProtected: true
  };

  // Configuration schema
  let config = {
    blockCookies: true,
    blockNewsletters: true,
    blockChats: true,
    restoreScroll: true,
    stopAutoplay: true,
    blockNotifications: true,
    blockSurveys: true,
    unblurContent: true,
    unlockCopy: true,
    cleanUrls: true,
    blockAntiAdblock: true,
    blockLoginWalls: true,
    reclaimViewport: true,
    blockSessionSpies: true,
    auditLogging: true,
    antiTamperDlp: true,
    blockWebRtcLeak: true,
    blockPhishingSpoofs: true,
    clipboardDlp: true,
    whitelistedDomains: [],
    customSelectors: []
  };

  // Multilingual button reject dictionary
  const REJECT_PHRASES = [
    // English
    'no, thank you',
    'no thank you',
    'reject all',
    'reject',
    'decline all',
    'decline',
    'deny all',
    'deny',
    'refuse all',
    'refuse',
    'necessary only',
    'only necessary',
    'essential only',
    'only essential',
    'use necessary cookies only',
    'reject non-essential',
    'continue without accepting',
    'do not accept',
    'disagree',
    // French
    'tout refuser',
    'refuser tout',
    'continuer sans accepter',
    'uniquement nécessaires',
    'refuser',
    // German
    'alle ablehnen',
    'ablehnen',
    'nur essenzielle',
    'nur notwendige',
    'nicht zustimmen',
    // Spanish
    'rechazar todo',
    'rechazar',
    'solo necesarias',
    'no acepto',
    // Italian
    'rifiuta tutto',
    'rifiuta',
    'solo necessari',
    // Dutch / Portuguese
    'alles weigeren',
    'weigeren',
    'rejeitar todos',
    'rejeitar'
  ];

  // Common tracking query parameters to sanitize
  const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'mc_eid', 'si', 'ref', 'ref_', 'tracking_id',
    'igshid', 'share_id', '_hsenc', '_hsmi', 'mkt_tok'
  ];

  // Specific CMP root and container selectors
  const CMP_CONTAINERS = [
    'div[id^="sp_message_container"]',
    'div[id*="sp_message_container"]',
    'iframe[id^="sp_message_iframe"]',
    'iframe[id*="sp_message_iframe"]',
    'iframe[src*="sourcepoint"]',
    '.sp_veil',
    'div[class*="sp_veil"]',
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '.onetrust-pc-dark-filter',
    '#CybotCookiebotDialog',
    '#CybotCookiebotDialogBodyUnderlay',
    '#CookiebotWidget',
    '#didomi-host',
    '.didomi-popup-container',
    '.didomi-popup-backdrop',
    '#usercentrics-root',
    'div[data-testid="uc-overlay"]',
    '#qc-cmp2-container',
    '.fc-ab-root',
    '.fc-consent-root',
    '.fc-dialog-overlay',
    '.truste_box_overlay',
    '.truste_overlay',
    '.cky-consent-container',
    '.cky-overlay',
    '#cookie-notice',
    '#cookie-banner',
    '#cookiebanner',
    '#cookieConsent',
    '.cc-banner',
    '.cc-window'
  ];

  // Live Chat Selectors
  const CHAT_CONTAINERS = [
    '#intercom-container',
    '#intercom-frame',
    '.intercom-lightweight-app',
    '#drift-widget',
    '#drift-frame-controller',
    '#launcher',
    '#webWidget',
    'iframe[id="webWidget"]',
    '.crisp-client',
    '#tawk-bubble-container',
    '#tawk-chat-frame',
    '#hubspot-messages-iframe-container',
    '#chat-widget-container',
    '#freshworks-container',
    '#fc_frame',
    '.zohosalesiq',
    '#zsiq_float',
    'iframe#gorgias-chat-container'
  ];

  // Survey & Feedback Selectors
  const SURVEY_CONTAINERS = [
    '#_hj_feedback_container',
    'div[class*="hotjar-feedback" i]',
    '#QSIFeedbackButton',
    'div[id*="survicate" i]',
    'div[class*="usabilla" i]',
    'div[id*="qualpro" i]'
  ];

  // Push Notification Prompt Selectors
  const NOTIFICATION_CONTAINERS = [
    '#onesignal-slidedown-container',
    '.onesignal-slidedown-container',
    '#onesignal-bell-container',
    '.onesignal-bell-container',
    '.webpush-prompt',
    'div[id*="push-notification" i]',
    'div[class*="notification-prompt" i]',
    'div[class*="push-prompt" i]'
  ];

  // Anti-adblock container selectors
  const ANTI_ADBLOCK_SELECTORS = [
    '#admiral-root',
    '.admiral-dialog',
    '.admiral-backdrop',
    'div[id^="admiral-"]',
    'div[class*="admiral-"]',
    '#bab-modal',
    '.bab-modal',
    '#adblock-modal',
    '.adblock-modal',
    '.adblock-overlay',
    '.adblock-wall',
    '.anti-adblock-container',
    'div[class*="adblock-wall"]',
    'div[id*="adblock-wall"]',
    'div[class*="ad-blocker-message"]',
    'div[class*="fc-ab-root"]',
    'div[class*="fc-dialog-container"]'
  ];

  // Forced sign-in and registration wall selectors
  const LOGIN_WALL_SELECTORS = [
    '.modal_signup_dialog',
    'div[id*="signup_wall" i]',
    'div[class*="signup_wall" i]',
    'div[id*="login_wall" i]',
    'div[class*="login_wall" i]',
    'div[class*="BaseSignupForm" i]',
    'div[id*="FullPageModal" i]',
    'div[class*="FullPageModal" i]',
    '#HdrModal',
    '#ContentWall',
    '#ContentWallHdr',
    'div[class*="hiding-wrapper" i]',
    'div[class*="hidingWrapper" i]',
    'div[class*="ContentWall" i]',
    'div[id*="ContentWall" i]',
    'div[data-test="content-wall"]',
    'div[data-test-id="full-page-signup-modal"]',
    '#desktop_unified_auth_container',
    'div[data-test-id="login-modal-default"]',
    'div[data-test-id="register-modal-default"]',
    'div[data-test-id="unauth-bottom-banner"]',
    'div[data-test-id="gift-wrap"]',
    '#login-modal',
    'auth-flow-modal',
    'reddit-drawer[modal-type="login"]',
    'div[slot="upsell-body"]',
    '.autobind_overlay',
    '.between_page_module',
    '.page_blur_promo',
    '.document_blur_promo',
    '#blocking_mask',
    'div[class*="sign-in-modal" i]',
    'div[class*="forced-login" i]',
    'div[id*="forced-login" i]',
    'div[class*="login-wall" i]',
    'div[id*="login-wall" i]',
    'div[class*="signup-wall" i]',
    'div[id*="signup-wall" i]',
    'div[class*="auth-modal" i]',
    'div[id*="auth-modal" i]'
  ];

  // Session Replay & Keystroke Spy tracking signatures (DLP)
  const SESSION_SPY_DOMAINS = [
    'static.hotjar.com',
    'script.hotjar.com',
    'fullstory.com',
    'cdn.logrocket.io',
    'cdn.lr-ingest.io',
    'clarity.ms',
    'smartlook.com',
    'inspectlet.com',
    'mouseflow.com',
    'crazyegg.com',
    'luckyorange.net'
  ];

  const SESSION_SPY_CONTAINERS = [
    'iframe[id*="_hjRemoteVarsFrame"]',
    'iframe[name*="_hjRemoteVarsFrame"]',
    '#_hj_feedback_container',
    'div[class*="hotjar-widget"]',
    'div[id*="clarity-"]',
    'div[class*="clarity-"]'
  ];

  // Scroll lock classes to neutralize
  const LOCK_CLASSES = [
    'sp-message-open',
    'didomi-popup-open',
    'modal-open',
    'no-scroll',
    'has-modal',
    'overflow-hidden',
    'prevent-scroll',
    'is-locked',
    'admiral-lock',
    'ab-lock',
    'adblock-lock',
    'signup-wall',
    'login-wall'
  ];

  /**
   * Cryptographic Audit Logging dispatcher (Compliance & DLP)
   */
  const lastLoggedEntries = new Set();
  function logIntervention(category, action, details) {
    if (!config.auditLogging) return;
    const key = `${category}:${action}:${details || ''}`;
    if (lastLoggedEntries.has(key)) return;
    lastLoggedEntries.add(key);

    if (lastLoggedEntries.size > 200) {
      lastLoggedEntries.clear();
    }

    try {
      chrome.runtime.sendMessage({
        action: 'recordAuditLog',
        entry: {
          domain: currentHostname,
          category: category,
          action: action,
          details: details ? details.slice(0, 120) : ''
        }
      }).catch(() => {});
    } catch (e) {}
  }

  /**
   * Safe element removal with telemetry
   */
  function eradicateElement(el, category) {
    if (!el || el.dataset.bcScrubbed) return false;
    try {
      el.dataset.bcScrubbed = 'true';
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('z-index', '-99999', 'important');
      el.style.setProperty('contain', 'strict', 'important');
      el.style.setProperty('content-visibility', 'hidden', 'important');

      if (document.readyState === 'loading') {
        prepaintMetrics.nodesSuppressedPrepaint++;
      }

      if (el.parentNode && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
        el.parentNode.removeChild(el);
      }

      blockedCount++;
      syncStats();
      const elIdentifier = el.id ? `#${el.id}` : (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : (el.tagName ? el.tagName.toLowerCase() : 'element'));
      logIntervention(category || 'element', 'suppressed', elIdentifier);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Dispatch realistic synthetic click events
   */
  function dispatchAuthenticClick(element) {
    if (!element) return;
    try {
      const opts = { bubbles: true, cancelable: true, view: window };
      element.dispatchEvent(new PointerEvent('pointerdown', opts));
      element.dispatchEvent(new MouseEvent('mousedown', opts));
      element.dispatchEvent(new PointerEvent('pointerup', opts));
      element.dispatchEvent(new MouseEvent('mouseup', opts));
      element.dispatchEvent(new MouseEvent('click', opts));
      if (typeof element.click === 'function') {
        element.click();
      }
    } catch (e) {}
  }

  /**
   * Send live blocked count to background worker
   */
  let syncTimer = null;
  function syncStats() {
    if (syncTimer) return;
    syncTimer = setTimeout(() => {
      syncTimer = null;
      try {
        chrome.runtime.sendMessage({
          action: 'updateCount',
          count: blockedCount,
          domain: currentHostname
        }).catch(() => {});
      } catch (e) {}
    }, 200);
  }

  /**
   * 1. Smart Cookie Consent Auto-Reject & Container Eraser
   */
  function sweepCookieWalls() {
    if (!config.blockCookies) return;

    try {
      const candidates = document.querySelectorAll('button, [role="button"], a.button, input[type="button"]');
      candidates.forEach(btn => {
        if (btn.dataset.bcChecked) return;
        btn.dataset.bcChecked = 'true';

        const label = (
          (btn.innerText || '') + ' ' +
          (btn.getAttribute('aria-label') || '') + ' ' +
          (btn.getAttribute('title') || '') + ' ' +
          (btn.value || '')
        ).trim().toLowerCase();

        const matchesReject = REJECT_PHRASES.some(phrase => label === phrase || label.startsWith(phrase + ' '));

        if (matchesReject) {
          const container = btn.closest('div, section, aside, [role="dialog"], [role="alertdialog"], [id*="sp_message" i], [class*="sp_message" i], [id*="consent" i], [class*="consent" i], [id*="cookie" i], [class*="cookie" i]');
          if (container) {
            dispatchAuthenticClick(btn);
            setTimeout(() => {
              eradicateElement(container, 'cookie-wall');
              breakScrollLock();
            }, 80);
          }
        }
      });
    } catch (e) {}

    CMP_CONTAINERS.forEach(selector => {
      try {
        const matches = document.querySelectorAll(selector);
        matches.forEach(el => eradicateElement(el, 'cookie-cmp'));
      } catch (e) {}
    });

    try {
      const backdrops = document.querySelectorAll('.sp_veil, div[class*="sp_veil"], div[id*="sp_veil"], div[class*="ot-fade-in"], div[class*="cookie-backdrop"]');
      backdrops.forEach(b => eradicateElement(b, 'veil'));
    } catch (e) {}
  }

  /**
   * 2. Live Chat Widgets Sweeper
   */
  function sweepChatWidgets() {
    if (!config.blockChats) return;
    CHAT_CONTAINERS.forEach(selector => {
      try {
        const matches = document.querySelectorAll(selector);
        matches.forEach(el => eradicateElement(el, 'chat'));
      } catch (e) {}
    });
  }

  /**
   * 3. Survey & Feedback Widgets
   */
  function sweepSurveys() {
    if (!config.blockSurveys) return;
    SURVEY_CONTAINERS.forEach(selector => {
      try {
        const matches = document.querySelectorAll(selector);
        matches.forEach(el => eradicateElement(el, 'survey'));
      } catch (e) {}
    });
  }

  /**
   * 3b. Push Notification Prompts
   */
  function sweepNotificationPrompts() {
    if (!config.blockNotifications) return;
    NOTIFICATION_CONTAINERS.forEach(selector => {
      try {
        const matches = document.querySelectorAll(selector);
        matches.forEach(el => eradicateElement(el, 'notification-prompt'));
      } catch (e) {}
    });

    try {
      const dialogs = document.querySelectorAll('div[role="dialog"], div[role="alertdialog"], div[class*="notification" i], div[class*="push" i]');
      dialogs.forEach(el => {
        if (el.dataset.bcScrubbed) return;
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') return;
        if ((parseInt(style.zIndex, 10) || 0) <= 50) return;
        const txt = (el.innerText || '').toLowerCase();
        if (
          txt.includes('allow notifications') ||
          txt.includes('enable notifications') ||
          txt.includes('turn on notifications') ||
          txt.includes('send you notifications')
        ) {
          eradicateElement(el, 'notification-prompt');
        }
      });
    } catch (e) {}
  }

  /**
   * 4. Newsletter & Lead-Gen Modals (Heuristic)
   */
  function sweepNewsletterModals() {
    if (!config.blockNewsletters) return;

    const promos = document.querySelectorAll('#desktop-dynamic-upsell-dialog, .desktop-dynamic-upsell-dialog, div[id^="om-"], div[class*="om-holder"], #privy-container, .klaviyo-form, .sumo-popup, .upsell-modal');
    promos.forEach(p => eradicateElement(p, 'promo'));

    try {
      const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email" i], input[placeholder*="email" i]');
      emailInputs.forEach(input => {
        let parent = input.parentElement;
        let depth = 0;
        while (parent && parent !== document.body && depth < 8) {
          const style = window.getComputedStyle(parent);
          const isModal = (style.position === 'fixed' || style.position === 'sticky') && parseInt(style.zIndex, 10) > 80;
          if (isModal) {
            const txt = (parent.innerText || '').toLowerCase();
            if (txt.includes('newsletter') || txt.includes('subscribe') || txt.includes('sign up') || txt.includes('discount') || txt.includes('% off')) {
              const prev = parent.previousElementSibling;
              if (prev && window.getComputedStyle(prev).position === 'fixed') {
                eradicateElement(prev, 'backdrop');
              }
              eradicateElement(parent, 'newsletter-modal');
              breakScrollLock();
              break;
            }
          }
          parent = parent.parentElement;
          depth++;
        }
      });
    } catch (e) {}
  }

  /**
   * 5. Unblur Content & Soft-Paywall Breaker
   */
  function sweepPaywallBlurs() {
    if (!config.unblurContent) return;

    try {
      // 1. Remove inline/class blur filters
      const blurred = document.querySelectorAll('[style*="blur("], [class*="blur"]');
      blurred.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.filter && style.filter.includes('blur')) {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('-webkit-filter', 'none', 'important');
          el.style.setProperty('backdrop-filter', 'none', 'important');
          el.style.setProperty('user-select', 'text', 'important');
        }
      });

      // 2. Uncap artificially truncated article bodies
      const truncated = document.querySelectorAll('article, [class*="article-body"], [class*="post-content"], [class*="story-body"], [id*="article-body"]');
      truncated.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.maxHeight && style.maxHeight !== 'none' && parseInt(style.maxHeight, 10) < 650) {
          el.style.setProperty('max-height', 'none', 'important');
          el.style.setProperty('height', 'auto', 'important');
          el.style.setProperty('overflow', 'visible', 'important');
        }
      });

      // 3. Remove paywall fade-out overlays
      const fadeOverlays = document.querySelectorAll('[class*="paywall-overlay"], [class*="fade-out"], [class*="gradient-overlay"], [class*="truncate-overlay"], [id*="paywall-overlay"]');
      fadeOverlays.forEach(o => eradicateElement(o, 'fade-overlay'));
    } catch (e) {}
  }

  /**
   * 6. Anti-Adblock Wall Bypasser (Admiral, BlockAdBlock, Funding Choices)
   */
  function sweepAntiAdblockWalls() {
    if (!config.blockAntiAdblock) return;

    // A. Specific anti-adblock framework selectors
    ANTI_ADBLOCK_SELECTORS.forEach(sel => {
      try {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => {
          eradicateElement(el, 'anti-adblock');
          breakScrollLock();
        });
      } catch (e) {}
    });

    // B. Heuristic scan for anti-adblock detection dialogs
    try {
      const modals = document.querySelectorAll('div, section, aside, [role="dialog"]');
      modals.forEach(el => {
        if (el.dataset.bcScrubbed) return;
        const style = window.getComputedStyle(el);
        const isOverlay = (style.position === 'fixed' || style.position === 'sticky') && parseInt(style.zIndex, 10) > 80;
        if (isOverlay) {
          const text = (el.innerText || '').toLowerCase();
          const matchesAntiAdblock = (
            text.includes('ad blocker detected') ||
            text.includes('adblock detected') ||
            text.includes('disable your ad blocker') ||
            text.includes('turn off your ad blocker') ||
            text.includes('disable adblock') ||
            text.includes('please whitelist our website') ||
            text.includes('using an ad blocker') ||
            text.includes('ad-blocker detected')
          );

          if (matchesAntiAdblock) {
            const prev = el.previousElementSibling;
            if (prev && window.getComputedStyle(prev).position === 'fixed') {
              eradicateElement(prev, 'anti-adblock-backdrop');
            }
            eradicateElement(el, 'anti-adblock-heuristic');
            breakScrollLock();
          }
        }
      });
    } catch (e) {}
  }

  /**
   * 7. Forced Sign-In & Login Wall Destroyer (Quora, Glassdoor, Pinterest, Scribd)
   */
  function sweepLoginWalls() {
    if (!config.blockLoginWalls) return;

    // A. Framework and target-specific selectors
    LOGIN_WALL_SELECTORS.forEach(sel => {
      try {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => {
          eradicateElement(el, 'login-wall');
          breakScrollLock();
        });
      } catch (e) {}
    });

    // B. Target-specific DOM unclamping and restoration
    // 1. Quora answers unmasking
    if (currentHostname.includes('quora.com')) {
      try {
        const blurredBoxes = document.querySelectorAll('.q-box, .q-text, div[class*="TruncatedWrapper"]');
        blurredBoxes.forEach(box => {
          if (box.style.filter && box.style.filter.includes('blur')) {
            box.style.setProperty('filter', 'none', 'important');
            box.style.setProperty('user-select', 'text', 'important');
          }
          if (box.style.maxHeight && box.style.maxHeight !== 'none') {
            box.style.setProperty('max-height', 'none', 'important');
            box.style.setProperty('height', 'auto', 'important');
            box.style.setProperty('overflow', 'visible', 'important');
          }
        });
      } catch (e) {}
    }

    // 2. Glassdoor review and salary unclamping
    if (currentHostname.includes('glassdoor.com')) {
      try {
        const truncatedReviews = document.querySelectorAll('div[id*="ReviewContent"], div[class*="reviewContent"], div[class*="ReviewText"], .gdReview');
        truncatedReviews.forEach(r => {
          r.style.setProperty('max-height', 'none', 'important');
          r.style.setProperty('height', 'auto', 'important');
          r.style.setProperty('overflow', 'visible', 'important');
          r.style.setProperty('filter', 'none', 'important');
        });
        const backdrops = document.querySelectorAll('.modal_backdrop, div[class*="modal_backdrop"]');
        backdrops.forEach(b => eradicateElement(b, 'glassdoor-backdrop'));
      } catch (e) {}
    }

    // 3. Scribd / SlideShare document page unblurring
    if (currentHostname.includes('scribd.com') || currentHostname.includes('slideshare.net')) {
      try {
        const blurredPages = document.querySelectorAll('.page_blur_promo, .document_blur_promo, .blurred_page, [class*="blurred_page"]');
        blurredPages.forEach(p => {
          p.style.setProperty('filter', 'none', 'important');
          p.style.setProperty('-webkit-filter', 'none', 'important');
        });
      } catch (e) {}
    }

    // C. Heuristic scan for forced signup/login modals
    try {
      const overlays = document.querySelectorAll('div, section, aside, [role="dialog"], [role="alertdialog"]');
      overlays.forEach(el => {
        if (el.dataset.bcScrubbed) return;
        const style = window.getComputedStyle(el);
        const isOverlay = (style.position === 'fixed' || style.position === 'sticky') && parseInt(style.zIndex, 10) > 80;
        if (isOverlay) {
          const text = (el.innerText || '').toLowerCase();
          const matchesLoginWall = (
            text.includes('sign up to continue reading') ||
            text.includes('sign in to continue reading') ||
            text.includes('log in to continue reading') ||
            text.includes('create an account to continue reading') ||
            text.includes('sign up to read the rest') ||
            text.includes('sign in to read the rest') ||
            text.includes('join to view full') ||
            text.includes('create a free account to continue')
          );

          if (matchesLoginWall) {
            const prev = el.previousElementSibling;
            if (prev && window.getComputedStyle(prev).position === 'fixed') {
              eradicateElement(prev, 'login-wall-backdrop');
            }
            eradicateElement(el, 'login-wall-heuristic');
            breakScrollLock();
          }
        }
      });
    } catch (e) {}
  }

  /**
   * 6. Universal Selection & Right-Click Unlocker
   */
  let selectionUnlocked = false;
  function enableSelectionAndCopy() {
    if (!config.unlockCopy || selectionUnlocked) return;
    selectionUnlocked = true;

    // Force user-select text
    try {
      document.documentElement.style.setProperty('-webkit-user-select', 'text', 'important');
      document.documentElement.style.setProperty('user-select', 'text', 'important');
    } catch (e) {}

    // Neutralize capture-phase blockers
    const events = ['contextmenu', 'selectstart', 'dragstart'];
    events.forEach(evtName => {
      window.addEventListener(evtName, (e) => {
        if (!config.unlockCopy) return;
        e.stopPropagation();
      }, true);
    });

    // Clear inline property overrides
    try {
      document.oncontextmenu = null;
      document.onselectstart = null;
      if (document.body) {
        document.body.oncontextmenu = null;
        document.body.onselectstart = null;
      }
    } catch (e) {}

    // Sanitize clipboard pollution on copy
    document.addEventListener('copy', (e) => {
      if (!config.unlockCopy) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const cleanText = selection.toString();
      if (cleanText && e.clipboardData) {
        e.stopImmediatePropagation();
        e.preventDefault();
        e.clipboardData.setData('text/plain', cleanText);
      }
    }, true);
  }

  /**
   * 7. Clean URL Tracking Parameters on Copy
   */
  let urlCleanerAttached = false;
  function attachUrlCleaner() {
    if (urlCleanerAttached) return;
    urlCleanerAttached = true;

    document.addEventListener('copy', (e) => {
      if (!config.cleanUrls) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const rawText = selection.toString().trim();

      if (rawText.startsWith('http://') || rawText.startsWith('https://')) {
        try {
          const parsed = new URL(rawText);
          let cleaned = false;
          TRACKING_PARAMS.forEach(param => {
            if (parsed.searchParams.has(param)) {
              parsed.searchParams.delete(param);
              cleaned = true;
            }
          });
          if (cleaned && e.clipboardData) {
            e.stopImmediatePropagation();
            e.preventDefault();
            e.clipboardData.setData('text/plain', parsed.toString());
            logIntervention('url-tracker', 'sanitized', parsed.hostname);
          }
        } catch (err) {}
      }
    }, true);
  }

  /**
   * 8. Bidirectional Clipboard DLP & Zero-Width Watermark Sanitizer
   * Inbound: Scrubs invisible zero-width characters (steganographic tracking watermarks)
   * Outbound: Detects sensitive API keys / credentials and prevents unauthorized background paste siphoning
   */
  const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\uFEFF\u2060\u180E\u200E\u200F\u202A-\u202E]/g;

  const SENSITIVE_TOKEN_PATTERNS = [
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[a-zA-Z0-9_-]{32,}\b/,
    /\bBearer\s+[a-zA-Z0-9_\-\.]{40,}\b/
  ];

  let clipboardDlpAttached = false;
  function attachClipboardDlp() {
    if (clipboardDlpAttached) return;
    clipboardDlpAttached = true;

    // 1. Intercept copy and cut events in capturing phase
    const handleCopyCut = (e) => {
      if (!config.clipboardDlp) return;
      const selection = window.getSelection();
      let text = selection ? selection.toString() : '';

      const activeEl = document.activeElement;
      if (!text && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        if (typeof start === 'number' && typeof end === 'number' && start !== end) {
          text = activeEl.value.substring(start, end);
        }
      }

      if (!text) return;

      let sanitizedText = text;
      let modified = false;

      // Inbound: Strip zero-width tracking watermarks
      if (ZERO_WIDTH_REGEX.test(text)) {
        sanitizedText = text.replace(ZERO_WIDTH_REGEX, '');
        modified = true;
        blockedCount++;
        syncStats();
        logIntervention('clipboard-dlp', 'watermark_stripped', 'Sanitized zero-width tracking watermarks from copied text');
      }

      // Outbound: Detect high-risk corporate API tokens on non-whitelisted sites
      const hasSecret = SENSITIVE_TOKEN_PATTERNS.some(pat => pat.test(text));
      if (hasSecret) {
        logIntervention('clipboard-dlp', 'credential_copy_audited', 'Sensitive API token or private key detected in clipboard payload');
      }

      if (modified && e.clipboardData) {
        e.stopImmediatePropagation();
        e.preventDefault();
        e.clipboardData.setData('text/plain', sanitizedText);
      }
    };

    document.addEventListener('copy', handleCopyCut, true);
    document.addEventListener('cut', handleCopyCut, true);

    // 2. Prevent unauthorized background paste siphoning
    document.addEventListener('paste', (e) => {
      if (!config.clipboardDlp) return;
      const target = e.target;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.getAttribute && target.getAttribute('contenteditable') === 'true')
      );

      if (!isInput && e.isTrusted === false) {
        e.stopImmediatePropagation();
        e.preventDefault();
        blockedCount++;
        syncStats();
        logIntervention('clipboard-dlp', 'paste_siphoning_blocked', 'Blocked synthetic paste event on non-editable element');
      }
    }, true);
  }

  /**
   * 9. Custom User Selectors
   */
  function sweepCustomSelectors() {
    if (!config.customSelectors || !config.customSelectors.length) return;
    config.customSelectors.forEach(rule => {
      try {
        if (!rule.domain || currentHostname.includes(rule.domain.toLowerCase())) {
          const els = document.querySelectorAll(rule.selector);
          els.forEach(el => eradicateElement(el, 'custom-rule'));
        }
      } catch (e) {}
    });
  }

  /**
   * 9. Scroll Lock Breaker
   */
  function breakScrollLock() {
    if (!config.restoreScroll) return;

    const html = document.documentElement;
    const body = document.body;
    if (!html) return;

    LOCK_CLASSES.forEach(cls => {
      if (html.classList.contains(cls)) html.classList.remove(cls);
      if (body && body.classList.contains(cls)) body.classList.remove(cls);
    });

    if (html.style.overflow === 'hidden' || html.style.overflowY === 'hidden') {
      html.style.setProperty('overflow', 'auto', 'important');
      html.style.setProperty('overflow-y', 'auto', 'important');
    }
    if (body) {
      if (body.style.overflow === 'hidden' || body.style.overflowY === 'hidden') {
        body.style.setProperty('overflow', 'auto', 'important');
        body.style.setProperty('overflow-y', 'auto', 'important');
      }
      if (body.style.position === 'fixed') {
        body.style.setProperty('position', 'static', 'important');
      }
    }
  }

  /**
   * 10. Autoplay Video Management
   */
  function enforceAutoplayPolicy() {
    if (!config.stopAutoplay) return;
    try {
      const videos = document.querySelectorAll('video');
      videos.forEach(v => {
        if (v.autoplay && !v.paused && !v.dataset.bcUserPlayed) {
          v.pause();
          v.autoplay = false;
        }
        if (!v.dataset.bcListener) {
          v.dataset.bcListener = 'true';
          v.addEventListener('play', () => {
            v.dataset.bcUserPlayed = 'true';
          });
        }
      });
    } catch (e) {}
  }

  /**
   * 11. Element Zapper (Click-to-Kill with Memory)
   */
  function generateStableSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return null;

    if (el.id && !/\d{4,}/.test(el.id)) {
      return `#${CSS.escape(el.id)}`;
    }

    const validClasses = Array.from(el.classList).filter(c =>
      !c.startsWith('browseclean') &&
      !/\d{4,}/.test(c) &&
      !c.includes(':')
    );

    const tagName = el.tagName.toLowerCase();

    if (validClasses.length > 0) {
      const classSelector = `${tagName}.${validClasses.slice(0, 2).map(c => CSS.escape(c)).join('.')}`;
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }

    let parent = el.parentElement;
    if (parent && parent !== document.body) {
      if (parent.id && !/\d{4,}/.test(parent.id)) {
        return `#${CSS.escape(parent.id)} > ${tagName}`;
      }
      const idx = Array.from(parent.children).indexOf(el) + 1;
      return `${parent.tagName.toLowerCase()} > ${tagName}:nth-child(${idx})`;
    }

    return tagName;
  }

  function startZapperMode() {
    if (isZapperActive) return;
    isZapperActive = true;

    // Create Zapper HUD Banner
    const banner = document.createElement('div');
    banner.id = 'browseclean-zapper-banner';
    banner.innerHTML = `
      <span>ZAPPER MODE &mdash; Hover and click any element to remove permanently.</span>
      <button id="browseclean-zapper-exit">Exit (Esc)</button>
    `;
    document.documentElement.appendChild(banner);

    let currentTarget = null;

    function onMouseOver(e) {
      if (e.target.closest('#browseclean-zapper-banner')) return;
      if (currentTarget) currentTarget.classList.remove('browseclean-zapper-hover');
      currentTarget = e.target;
      currentTarget.classList.add('browseclean-zapper-hover');
    }

    function onMouseOut(e) {
      if (e.target === currentTarget) {
        e.target.classList.remove('browseclean-zapper-hover');
        currentTarget = null;
      }
    }

    function onClick(e) {
      if (e.target.closest('#browseclean-zapper-banner')) return;
      e.preventDefault();
      e.stopPropagation();

      const target = currentTarget || e.target;
      if (target) {
        target.classList.remove('browseclean-zapper-hover');
        const selector = generateStableSelector(target);

        // Remove element immediately
        eradicateElement(target, 'zapped');

        // Persist to customSelectors
        if (selector) {
          chrome.storage.local.get(['settings'], (res) => {
            const current = res.settings || config;
            if (!current.customSelectors) current.customSelectors = [];
            current.customSelectors.push({ domain: currentHostname, selector: selector });
            chrome.storage.local.set({ settings: current });
            config = current;
          });
        }
      }

      exitZapperMode();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        exitZapperMode();
      }
    }

    function exitZapperMode() {
      isZapperActive = false;
      if (currentTarget) currentTarget.classList.remove('browseclean-zapper-hover');
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      const b = document.getElementById('browseclean-zapper-banner');
      if (b) b.remove();
    }

    document.getElementById('browseclean-zapper-exit').addEventListener('click', exitZapperMode);
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  /**
   * 12. Viewport Reclaim Engine (Sticky Header & Floating Bar Shrinker)
   */
  let viewportListenerAttached = false;
  function reclaimViewportRealEstate() {
    if (!config.reclaimViewport) {
      document.querySelectorAll('.browseclean-compact-header').forEach(el => el.classList.remove('browseclean-compact-header'));
      document.querySelectorAll('.browseclean-unstick').forEach(el => el.classList.remove('browseclean-unstick'));
      document.querySelectorAll('.browseclean-suppress-dock').forEach(el => el.classList.remove('browseclean-suppress-dock'));
      return;
    }

    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    // Return to top: revert compressed headers so full hero navbar displays
    if (scrollY <= 60) {
      document.querySelectorAll('.browseclean-compact-header').forEach(el => el.classList.remove('browseclean-compact-header'));
      return;
    }

    if (scrollY > 160) {
      const candidates = document.querySelectorAll('header, [role="banner"], div[class*="header" i], div[class*="navbar" i], div[class*="nav-bar" i], div[class*="announcement" i], div[class*="promo-bar" i], div[class*="bottom-bar" i], div[class*="sticky" i], div[class*="floating" i]');
      candidates.forEach(el => {
        if (el.dataset.bcScrubbed || el.id === 'browseclean-zapper-banner') return;
        const style = window.getComputedStyle(el);
        const isSticky = style.position === 'fixed' || style.position === 'sticky';
        if (!isSticky) return;

        const rect = el.getBoundingClientRect();

        // 1. Un-stick secondary announcement ribbons & promo banners pinned to top
        if (rect.top <= 10 && rect.height > 20 && rect.height < 140) {
          const className = (el.className || '').toString().toLowerCase();
          const id = (el.id || '').toString().toLowerCase();
          const isRibbon = (
            className.includes('announcement') ||
            className.includes('promo') ||
            className.includes('notification') ||
            className.includes('top-bar') ||
            className.includes('banner') ||
            id.includes('announcement') ||
            id.includes('promo') ||
            id.includes('banner')
          ) && el.tagName !== 'HEADER' && el.tagName !== 'NAV';

          if (isRibbon && !el.classList.contains('browseclean-unstick')) {
            el.classList.add('browseclean-unstick');
          }
        }

        // 2. Shrink oversized primary sticky headers (>75px tall)
        if (rect.top <= 10 && rect.height > 75) {
          if (!el.classList.contains('browseclean-compact-header') && !el.classList.contains('browseclean-unstick')) {
            el.classList.add('browseclean-compact-header');
          }
        }

        // 3. Suppress floating bottom docks / install app bars
        if (rect.bottom >= window.innerHeight - 8 && rect.top > window.innerHeight * 0.65) {
          const className = (el.className || '').toString().toLowerCase();
          const id = (el.id || '').toString().toLowerCase();
          const isBottomDock = (
            className.includes('bottom') ||
            className.includes('footer') ||
            className.includes('dock') ||
            className.includes('share') ||
            className.includes('app-banner') ||
            id.includes('bottom') ||
            id.includes('footer') ||
            id.includes('dock')
          );
          if (isBottomDock && !el.classList.contains('browseclean-suppress-dock')) {
            el.classList.add('browseclean-suppress-dock');
          }
        }
      });
    }
  }

  function attachViewportReclaimListener() {
    if (viewportListenerAttached) return;
    viewportListenerAttached = true;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          reclaimViewportRealEstate();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * 13. Session Replay & DOM Spy Neutralizer (Data Loss Prevention / DLP)
   */
  let dlpStubInjected = false;
  function injectDLPPageStubs() {
    if (dlpStubInjected || !config.blockSessionSpies) return;
    dlpStubInjected = true;
    try {
      const script = document.createElement('script');
      script.textContent = `
        (() => {
          const noop = () => {};
          const noopProxy = new Proxy(noop, {
            get: () => noopProxy,
            apply: () => undefined
          });
          const freezeGlobal = (name) => {
            try {
              Object.defineProperty(window, name, {
                value: noopProxy,
                writable: false,
                configurable: false
              });
            } catch (e) {}
          };
          ['hj', '_hjSettings', 'FS', 'LogRocket', 'clarity', 'smartlook', '__insp', '_mfq', 'CE2'].forEach(freezeGlobal);
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  function sweepSessionSpies() {
    if (!config.blockSessionSpies) return;
    injectDLPPageStubs();

    // 1. Remove tracking containers and iframes
    SESSION_SPY_CONTAINERS.forEach(sel => {
      try {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach(n => eradicateElement(n, 'session-spy'));
      } catch (e) {}
    });

    // 2. Intercept and neutralize surveillance scripts in DOM
    try {
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(s => {
        if (s.dataset.bcDlpScrubbed) return;
        const src = (s.src || '').toLowerCase();
        const isSpy = SESSION_SPY_DOMAINS.some(d => src.includes(d));
        if (isSpy) {
          s.dataset.bcDlpScrubbed = 'true';
          s.type = 'javascript/blocked';
          if (s.parentNode) s.parentNode.removeChild(s);
          blockedCount++;
          syncStats();
          logIntervention('session-spy', 'neutralized', src.split('?')[0]);
        }
      });
    } catch (e) {}
  }

  /**
   * Main World Anti-Tamper & Prototype Hardening
   */
  function injectAntiTamperShield() {
    if (!config.antiTamperDlp) return;
    if (document.getElementById('bc-anti-tamper-guard')) return;
    try {
      const script = document.createElement('script');
      script.id = 'bc-anti-tamper-guard';
      script.textContent = `
        (function() {
          if (window.__bc_tamper_shield_active) return;
          window.__bc_tamper_shield_active = true;

          // Guard Object.prototype against prototype pollution
          try {
            Object.defineProperty(Object.prototype, '__bc_hardened', {
              value: true,
              writable: false,
              configurable: false
            });
          } catch (e) {}

          // Protect Document query methods against hostile poisoning
          try {
            const origQS = Document.prototype.querySelector;
            const origQSA = Document.prototype.querySelectorAll;
            Object.defineProperty(Document.prototype, '__bc_orig_qs', {
              value: origQS,
              writable: false,
              configurable: false
            });
            Object.defineProperty(Document.prototype, '__bc_orig_qsa', {
              value: origQSA,
              writable: false,
              configurable: false
            });
          } catch (e) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  /**
   * Client-Side Form DLP (Data Loss Prevention) & Credential Guard
   * Shields sensitive inputs from unauthorized script scraping and synthetic reads
   */
  const SENSITIVE_INPUT_SELECTORS = [
    'input[type="password"]',
    'input[autocomplete*="password"]',
    'input[autocomplete*="cc-"]',
    'input[autocomplete*="credit-card"]',
    'input[name*="cvv" i]',
    'input[name*="cvc" i]',
    'input[name*="cardnumber" i]',
    'input[name*="ssn" i]',
    'input[id*="cvv" i]',
    'input[id*="cvc" i]',
    'input[id*="cardnumber" i]',
    'input[id*="ssn" i]',
    'input[data-sensitive="true"]'
  ];

  function enforceFormDLP() {
    if (!config.antiTamperDlp) return;
    injectAntiTamperShield();

    try {
      const sensitiveInputs = document.querySelectorAll(SENSITIVE_INPUT_SELECTORS.join(', '));
      sensitiveInputs.forEach(input => {
        if (input.dataset.bcDlpProtected === 'true') return;
        input.dataset.bcDlpProtected = 'true';

        // 1. Defend against synthetic event scraping (scripts dispatching fake input/change events to siphon values)
        const blockSyntheticReads = (e) => {
          if (e.isTrusted === false) {
            e.stopImmediatePropagation();
            e.preventDefault();
            blockedCount++;
            syncStats();
            logIntervention('dlp-shield', 'synthetic_scrape_blocked', input.name || input.id || input.type || 'credential_field');
          }
        };

        input.addEventListener('change', blockSyntheticReads, true);
        input.addEventListener('input', blockSyntheticReads, true);
        input.addEventListener('copy', () => {
          if (input.type === 'password' || (input.name && /cvv|cvc/i.test(input.name))) {
            logIntervention('dlp-shield', 'clipboard_read_prevented', input.name || input.type);
          }
        }, true);

        // Record initial field shielding in compliance log
        logIntervention('dlp-shield', 'input_protected', input.name || input.id || input.type || 'sensitive_field');
      });
    } catch (e) {}
  }

  /**
   * 15. WebRTC & Internal IP Leak Shield (Zero-Trust Network Defense)
   * Neutralizes STUN/ICE host candidate discovery to prevent local LAN IP disclosure (10.x, 192.168.x, 172.16-31.x)
   * and VPN bypass deanonymization.
   */
  const CONFERENCING_DOMAINS = [
    'meet.google.com',
    'zoom.us',
    'teams.microsoft.com',
    'webex.com',
    'discord.com',
    'slack.com',
    'chime.aws'
  ];

  let webrtcShieldInjected = false;
  function injectWebRtcShield() {
    if (webrtcShieldInjected || !config.blockWebRtcLeak) return;
    const isWhitelisted = (config.whitelistedDomains && config.whitelistedDomains.includes(currentHostname)) ||
                          CONFERENCING_DOMAINS.some(d => currentHostname === d || currentHostname.endsWith('.' + d));
    if (isWhitelisted) return;

    webrtcShieldInjected = true;
    try {
      const script = document.createElement('script');
      script.id = 'bc-webrtc-shield';
      script.textContent = `
        (function() {
          if (window.__bc_webrtc_shield_active) return;
          window.__bc_webrtc_shield_active = true;

          const OrigPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
          if (!OrigPeerConnection) return;

          const PRIVATE_IP_REGEX = /^(10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}|169\\.254\\.\\d{1,3}\\.\\d{1,3}|127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|100\\.(6[4-9]|[7-9]\\d|1[01]\\d|12[0-7])\\.\\d{1,3}\\.\\d{1,3}|0\\.0\\.0\\.0|fe80:[0-9a-fA-F:]*|fc00:[0-9a-fA-F:]*|fd00:[0-9a-fA-F:]*|::1|::ffff:(?:10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.|127\\.))/i;

          function isPrivateOrSuspicious(candidateStr) {
            if (!candidateStr || typeof candidateStr !== 'string') return false;
            if (PRIVATE_IP_REGEX.test(candidateStr)) return true;
            const parts = candidateStr.split(' ');
            for (let i = 0; i < parts.length; i++) {
              if (PRIVATE_IP_REGEX.test(parts[i])) return true;
            }
            if (candidateStr.includes(' typ host') && !candidateStr.includes('.local')) {
              for (let i = 0; i < parts.length; i++) {
                if (PRIVATE_IP_REGEX.test(parts[i])) return true;
              }
            }
            return false;
          }

          function sanitizeSdp(sdp) {
            if (!sdp || typeof sdp !== 'string') return { sdp: sdp, modified: false };
            const lines = sdp.split(/\\r\\n|\\n/);
            const sanitizedLines = [];
            let modified = false;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('a=candidate:')) {
                if (isPrivateOrSuspicious(line)) {
                  modified = true;
                  continue;
                }
              } else if (line.startsWith('c=IN IP4 ')) {
                const ip = line.slice(9).trim();
                if (PRIVATE_IP_REGEX.test(ip)) {
                  sanitizedLines.push('c=IN IP4 0.0.0.0');
                  modified = true;
                  continue;
                }
              }
              sanitizedLines.push(line);
            }

            return {
              sdp: sanitizedLines.join('\\r\\n'),
              modified: modified
            };
          }

          function dispatchIntervention(detail) {
            try {
              window.dispatchEvent(new CustomEvent('__bc_webrtc_intervention', { detail: detail }));
            } catch (e) {}
          }

          function ProxiedPeerConnection(configuration, constraints) {
            let safeConfig = configuration;
            if (safeConfig && Array.isArray(safeConfig.iceServers)) {
              safeConfig = Object.assign({}, configuration, {
                iceServers: []
              });
              dispatchIntervention('Suppressed untrusted STUN servers');
            }

            const pc = new OrigPeerConnection(safeConfig, constraints);

            // Intercept createOffer to sanitize local candidate SDP
            const origCreateOffer = pc.createOffer;
            pc.createOffer = function() {
              return origCreateOffer.apply(this, arguments).then(function(desc) {
                if (desc && desc.sdp) {
                  const res = sanitizeSdp(desc.sdp);
                  if (res.modified) {
                    dispatchIntervention('Scrubbed internal LAN IP candidates from WebRTC offer SDP');
                    try {
                      return new RTCSessionDescription({ type: desc.type, sdp: res.sdp });
                    } catch(e) {
                      desc.sdp = res.sdp;
                    }
                  }
                }
                return desc;
              });
            };

            // Intercept createAnswer to sanitize answer SDP
            const origCreateAnswer = pc.createAnswer;
            pc.createAnswer = function() {
              return origCreateAnswer.apply(this, arguments).then(function(desc) {
                if (desc && desc.sdp) {
                  const res = sanitizeSdp(desc.sdp);
                  if (res.modified) {
                    dispatchIntervention('Scrubbed internal LAN IP candidates from WebRTC answer SDP');
                    try {
                      return new RTCSessionDescription({ type: desc.type, sdp: res.sdp });
                    } catch(e) {
                      desc.sdp = res.sdp;
                    }
                  }
                }
                return desc;
              });
            };

            // Intercept setLocalDescription
            const origSetLocalDescription = pc.setLocalDescription;
            pc.setLocalDescription = function(desc) {
              if (desc && desc.sdp) {
                const res = sanitizeSdp(desc.sdp);
                if (res.modified) {
                  dispatchIntervention('Sanitized internal LAN IP before setLocalDescription');
                  try {
                    arguments[0] = new RTCSessionDescription({ type: desc.type, sdp: res.sdp });
                  } catch(e) {
                    desc.sdp = res.sdp;
                  }
                }
              }
              return origSetLocalDescription.apply(this, arguments);
            };

            // Intercept setRemoteDescription
            const origSetRemoteDescription = pc.setRemoteDescription;
            pc.setRemoteDescription = function(desc) {
              if (desc && desc.sdp) {
                const res = sanitizeSdp(desc.sdp);
                if (res.modified) {
                  dispatchIntervention('Sanitized internal LAN IP before setRemoteDescription');
                  try {
                    arguments[0] = new RTCSessionDescription({ type: desc.type, sdp: res.sdp });
                  } catch(e) {
                    desc.sdp = res.sdp;
                  }
                }
              }
              return origSetRemoteDescription.apply(this, arguments);
            };

            // Intercept addIceCandidate to drop private LAN candidate injections
            const origAddIceCandidate = pc.addIceCandidate;
            pc.addIceCandidate = function(candidate, successCallback, failureCallback) {
              if (candidate) {
                const candStr = typeof candidate === 'string' ? candidate : (candidate.candidate || '');
                if (isPrivateOrSuspicious(candStr)) {
                  dispatchIntervention('Dropped private LAN candidate in addIceCandidate');
                  if (typeof successCallback === 'function') successCallback();
                  return Promise.resolve();
                }
              }
              return origAddIceCandidate.apply(this, arguments);
            };

            // Virtualize local and remote description getters across all SDP properties
            function virtualizeSdpGetter(target, prop) {
              const origDescriptor = Object.getOwnPropertyDescriptor(OrigPeerConnection.prototype, prop);
              if (origDescriptor && origDescriptor.get) {
                Object.defineProperty(target, prop, {
                  get: function() {
                    const desc = origDescriptor.get.call(this);
                    if (desc && desc.sdp) {
                      const res = sanitizeSdp(desc.sdp);
                      if (res.modified) {
                        try {
                          return new RTCSessionDescription({ type: desc.type, sdp: res.sdp });
                        } catch(e) {
                          desc.sdp = res.sdp;
                        }
                      }
                    }
                    return desc;
                  },
                  configurable: true,
                  enumerable: true
                });
              }
            }

            [
              'localDescription', 'currentLocalDescription', 'pendingLocalDescription',
              'remoteDescription', 'currentRemoteDescription', 'pendingRemoteDescription'
            ].forEach(function(p) {
              virtualizeSdpGetter(pc, p);
            });

            // Virtualize onicecandidate property
            let userCandidateHandler = null;
            Object.defineProperty(pc, 'onicecandidate', {
              get: function() {
                return userCandidateHandler;
              },
              set: function(fn) {
                if (typeof fn !== 'function') {
                  userCandidateHandler = null;
                  return;
                }
                userCandidateHandler = function(event) {
                  if (event && event.candidate && event.candidate.candidate) {
                    if (isPrivateOrSuspicious(event.candidate.candidate)) {
                      dispatchIntervention('Neutralized private LAN ICE candidate: ' + event.candidate.candidate.slice(0, 35));
                      return fn.call(this, new RTCPeerConnectionIceEvent('icecandidate', { candidate: null }));
                    }
                  }
                  return fn.apply(this, arguments);
                };
              },
              configurable: true,
              enumerable: true
            });

            // Virtualize addEventListener for icecandidate
            const origAddEventListener = pc.addEventListener;
            pc.addEventListener = function(type, listener, options) {
              if (type === 'icecandidate' && typeof listener === 'function') {
                const wrappedListener = function(event) {
                  if (event && event.candidate && event.candidate.candidate) {
                    if (isPrivateOrSuspicious(event.candidate.candidate)) {
                      dispatchIntervention('Neutralized private LAN ICE candidate in event listener');
                      return;
                    }
                  }
                  return listener.apply(this, arguments);
                };
                return origAddEventListener.call(this, type, wrappedListener, options);
              }
              return origAddEventListener.apply(this, arguments);
            };

            // Virtualize getStats to scrub local-candidate and candidate-pair IPs
            const origGetStats = pc.getStats;
            pc.getStats = function() {
              return origGetStats.apply(this, arguments).then(function(statsReport) {
                try {
                  if (statsReport && typeof statsReport.forEach === 'function') {
                    const sanitized = new Map();
                    statsReport.forEach(function(report, id) {
                      if (report && (report.type === 'local-candidate' || report.type === 'remote-candidate' || report.type === 'candidate-pair')) {
                        const cloned = Object.assign({}, report);
                        if (cloned.ip && PRIVATE_IP_REGEX.test(cloned.ip)) {
                          cloned.ip = '0.0.0.0';
                          dispatchIntervention('Scrubbed internal LAN IP from getStats report');
                        }
                        if (cloned.address && PRIVATE_IP_REGEX.test(cloned.address)) {
                          cloned.address = '0.0.0.0';
                          dispatchIntervention('Scrubbed internal LAN address from getStats report');
                        }
                        sanitized.set(id, cloned);
                      } else {
                        sanitized.set(id, report);
                      }
                    });
                    return sanitized;
                  }
                } catch(e) {}
                return statsReport;
              });
            };

            return pc;
          }

          ProxiedPeerConnection.prototype = OrigPeerConnection.prototype;
          if (OrigPeerConnection.generateCertificate) {
            ProxiedPeerConnection.generateCertificate = OrigPeerConnection.generateCertificate.bind(OrigPeerConnection);
          }

          try {
            window.RTCPeerConnection = ProxiedPeerConnection;
            if (window.webkitRTCPeerConnection) {
              window.webkitRTCPeerConnection = ProxiedPeerConnection;
            }
            if (window.mozRTCPeerConnection) {
              window.mozRTCPeerConnection = ProxiedPeerConnection;
            }
          } catch(e) {}

          // Secure RTCIceCandidate constructor against manual candidate fabrication
          try {
            const OrigIceCandidate = window.RTCIceCandidate;
            if (OrigIceCandidate) {
              function ProxiedIceCandidate(initDict) {
                if (initDict && initDict.candidate) {
                  if (isPrivateOrSuspicious(initDict.candidate)) {
                    dispatchIntervention('Sanitized candidate in RTCIceCandidate constructor');
                    initDict = Object.assign({}, initDict, {
                      candidate: ''
                    });
                  }
                }
                return new OrigIceCandidate(initDict);
              }
              ProxiedIceCandidate.prototype = OrigIceCandidate.prototype;
              window.RTCIceCandidate = ProxiedIceCandidate;
            }
          } catch(e) {}

          // Secure iframe isolation against RTCPeerConnection leakage
          try {
            const origIframeContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
            if (origIframeContentWindow && origIframeContentWindow.get) {
              Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                get: function() {
                  const win = origIframeContentWindow.get.call(this);
                  if (win && !win.__bc_webrtc_shield_active) {
                    try {
                      win.RTCPeerConnection = ProxiedPeerConnection;
                      if (win.webkitRTCPeerConnection) win.webkitRTCPeerConnection = ProxiedPeerConnection;
                      if (win.mozRTCPeerConnection) win.mozRTCPeerConnection = ProxiedPeerConnection;
                      win.__bc_webrtc_shield_active = true;
                    } catch(e) {}
                  }
                  return win;
                },
                configurable: true,
                enumerable: true
              });
            }
          } catch(e) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  // Intercept WebRTC IP leak neutralization events dispatched by page shield
  window.addEventListener('__bc_webrtc_intervention', (e) => {
    blockedCount++;
    syncStats();
    logIntervention('webrtc-shield', 'leak_blocked', e.detail || 'Neutralized private LAN/STUN ICE candidate');
  });

  /**
   * 16. Homoglyph & Punycode Phishing Detector (Anti-Spoofing Barrier)
   * Detects deceptive IDN Punycode domains (xn--), mixed-script homoglyphs,
   * and brand typosquatting targeting enterprise credentials.
   */
  const PROTECTED_BRANDS = [
    'google', 'microsoft', 'apple', 'amazon', 'paypal', 'github', 'gitlab',
    'facebook', 'netflix', 'twitter', 'linkedin', 'dropbox', 'adobe',
    'instagram', 'whatsapp', 'chase', 'wellsfargo', 'bankofamerica',
    'citibank', 'okta', 'salesforce', 'slack', 'coinbase', 'binance'
  ];

  const HOMOGLYPH_MAP = {
    '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c',
    '\u0443': 'y', '\u0445': 'x', '\u0456': 'i', '\u0458': 'j', '\u0455': 's',
    '\u0501': 'd', '\u051B': 'q', '\u03BF': 'o', '\u03B1': 'a', '\u03C1': 'p',
    '\u03BD': 'v', '\u03C9': 'w', '0': 'o', '1': 'l'
  };

  function normalizeHomoglyphs(str) {
    let result = '';
    for (const char of str.toLowerCase()) {
      result += HOMOGLYPH_MAP[char] || char;
    }
    return result;
  }

  function detectPhishingSpoof(hostname) {
    if (!hostname || typeof hostname !== 'string') return null;
    const parts = hostname.toLowerCase().split('.');
    if (parts.length < 2) return null;

    const label = parts[parts.length - 2];

    // 1. Punycode internationalized domain names (IDN)
    if (hostname.includes('xn--')) {
      return {
        type: 'punycode_idn',
        reason: 'Punycode Internationalized Domain Name (IDN) detected'
      };
    }

    // 2. Mixed-script homoglyphs (mixing Latin with Cyrillic or Greek)
    const hasLatin = /[a-z]/.test(label);
    const hasCyrillicOrGreek = /[\u0400-\u04FF\u0370-\u03FF]/.test(label);
    if (hasLatin && hasCyrillicOrGreek) {
      return {
        type: 'mixed_script_homoglyph',
        reason: 'Deceptive mixed Latin and Cyrillic/Greek characters detected'
      };
    }

    // 3. Protected brand impersonation via homoglyphs or typosquatting
    const normalized = normalizeHomoglyphs(label);
    const matchedBrand = PROTECTED_BRANDS.find(b => normalized === b || normalized.includes(b));
    if (matchedBrand) {
      const isLegitDomain = hostname === `${matchedBrand}.com` || hostname.endsWith(`.${matchedBrand}.com`);
      if (!isLegitDomain && (label !== matchedBrand || hasCyrillicOrGreek || normalized !== label)) {
        return {
          type: 'brand_impersonation',
          reason: `Deceptive lookalike domain impersonating ${matchedBrand.toUpperCase()}`,
          target: matchedBrand
        };
      }
    }

    return null;
  }

  let phishingBarrierActive = false;
  function renderSecurityBarrier(spoofInfo) {
    if (phishingBarrierActive || !config.blockPhishingSpoofs) return;
    if (document.getElementById('browseclean-phishing-barrier')) return;
    phishingBarrierActive = true;

    try {
      const barrier = document.createElement('div');
      barrier.id = 'browseclean-phishing-barrier';
      barrier.innerHTML = `
        <div class="bc-barrier-card">
          <div class="bc-barrier-tag">Security Alert: Deceptive Domain</div>
          <h1 class="bc-barrier-title">Potential Phishing or Spoofing Attack Blocked</h1>
          <p class="bc-barrier-desc">
            BrowseClean Zero-Trust engine detected that this site uses deceptive Punycode, mixed-script homoglyphs, or character substitutions mimicking a legitimate enterprise brand.
          </p>
          <div class="bc-barrier-meta">
            <div><strong>Host:</strong> ${currentHostname}</div>
            <div><strong>Vector:</strong> ${spoofInfo.reason}</div>
            <div><strong>Type:</strong> ${spoofInfo.type}</div>
          </div>
          <div class="bc-barrier-actions">
            <button class="bc-barrier-btn-primary" id="bc-barrier-leave-btn">Leave Site (Recommended)</button>
            <button class="bc-barrier-btn-secondary" id="bc-barrier-bypass-btn">Bypass Barrier</button>
          </div>
        </div>
      `;

      (document.body || document.documentElement).appendChild(barrier);

      const leaveBtn = document.getElementById('bc-barrier-leave-btn');
      if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'about:blank';
          }
        });
      }

      const bypassBtn = document.getElementById('bc-barrier-bypass-btn');
      if (bypassBtn) {
        bypassBtn.addEventListener('click', () => {
          barrier.remove();
          phishingBarrierActive = false;
        });
      }

      blockedCount++;
      syncStats();
      logIntervention('security', 'phishing_spoof_blocked', `${spoofInfo.type}: ${currentHostname}`);
    } catch (e) {}
  }

  function enforcePhishingDefense() {
    if (!config.blockPhishingSpoofs) return;
    const spoof = detectPhishingSpoof(currentHostname);
    if (spoof) {
      renderSecurityBarrier(spoof);
    }
  }

  /**
   * Main Pipeline execution
   */
  function executeSweep() {
    if (!isCleanActive) return;
    enforcePhishingDefense();
    sweepCookieWalls();
    sweepChatWidgets();
    sweepSurveys();
    sweepNotificationPrompts();
    sweepNewsletterModals();
    sweepPaywallBlurs();
    sweepAntiAdblockWalls();
    sweepLoginWalls();
    sweepSessionSpies();
    enforceFormDLP();
    injectWebRtcShield();
    sweepCustomSelectors();
    breakScrollLock();
    enforceAutoplayPolicy();
    enableSelectionAndCopy();
    attachUrlCleaner();
    attachClipboardDlp();
    attachViewportReclaimListener();
    reclaimViewportRealEstate();
  }

  /**
   * Fast Debounced Mutation Observer
   */
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!isCleanActive || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      executeSweep();
      scheduled = false;
    });
  });

  /**
   * Engine Initialization
   */
  function startEngine() {
    chrome.runtime.sendMessage({ action: 'getEffectiveSettings' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.settings) {
        // Fallback to local storage if background worker is starting
        chrome.storage.local.get(['settings'], (res) => {
          if (res && res.settings) {
            config = Object.assign(config, res.settings);
          }
          initializeEnginePipeline();
        });
        return;
      }

      config = Object.assign(config, response.settings);
      initializeEnginePipeline();
    });
  }

  // Immediate Synchronous Pre-Paint Bootstrap (Zero-FOUC Guarantee)
  function executePrepaintBootstrap() {
    try {
      const cachedWhitelist = sessionStorage.getItem('__bc_whitelisted');
      if (cachedWhitelist === 'true') {
        isCleanActive = false;
        return;
      }
    } catch(e) {}

    // Synchronously execute pre-paint defenses at document_start
    injectDLPPageStubs();
    injectAntiTamperShield();
    injectWebRtcShield();
    enforcePhishingDefense();

    if (typeof performance !== 'undefined' && performance.now) {
      prepaintMetrics.prepaintDurationMs = Math.round((performance.now() - prepaintMetrics.startTime) * 100) / 100;
    }
  }

  function initializeEnginePipeline() {
    if (config.whitelistedDomains && config.whitelistedDomains.includes(currentHostname)) {
      isCleanActive = false;
      try { sessionStorage.setItem('__bc_whitelisted', 'true'); } catch(e) {}
      return;
    }
    try { sessionStorage.removeItem('__bc_whitelisted'); } catch(e) {}

    injectDLPPageStubs();
    injectAntiTamperShield();
    injectWebRtcShield();
    enforcePhishingDefense();
    executeSweep();

    const root = document.documentElement || document;
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    let sweeps = 0;
    const interval = setInterval(() => {
      executeSweep();
      sweeps++;
      if (sweeps > 20) clearInterval(interval);
    }, 500);
  }

  // Handle messages from popup / options
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'policyUpdated') {
      if (msg.settings) {
        config = Object.assign(config, msg.settings);
      }
      if (config.whitelistedDomains && config.whitelistedDomains.includes(currentHostname)) {
        isCleanActive = false;
      } else {
        isCleanActive = true;
        executeSweep();
      }
      sendResponse({ received: true });
      return true;
    }

    if (msg.action === 'getStatus') {
      if (prepaintMetrics.prepaintDurationMs === 0 && typeof performance !== 'undefined' && performance.now) {
        prepaintMetrics.prepaintDurationMs = Math.round((performance.now() - prepaintMetrics.startTime) * 100) / 100;
      }
      sendResponse({
        enabled: isCleanActive,
        domain: currentHostname,
        blockedCount: blockedCount,
        settings: config,
        prepaintMetrics: prepaintMetrics
      });
      return true;
    }

    if (msg.action === 'manualSweep') {
      executeSweep();
      sendResponse({ success: true, count: blockedCount });
      return true;
    }

    if (msg.action === 'startZapper') {
      startZapperMode();
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === 'updateSettings') {
      config = Object.assign(config, msg.settings);
      const whitelisted = config.whitelistedDomains && config.whitelistedDomains.includes(currentHostname);
      isCleanActive = !whitelisted;
      if (isCleanActive) {
        executeSweep();
      }
      sendResponse({ success: true, enabled: isCleanActive });
      return true;
    }
  });

  executePrepaintBootstrap();
  startEngine();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeSweep);
  }
})();
