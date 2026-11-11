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

  const currentHostname = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';
  let isCleanActive = true;
  let blockedCount = 0;
  let isZapperActive = false;

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

      if (el.parentNode && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
        el.parentNode.removeChild(el);
      }

      blockedCount++;
      syncStats();
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
          }
        } catch (err) {}
      }
    }, true);
  }

  /**
   * 8. Custom User Selectors
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
   * Main Pipeline execution
   */
  function executeSweep() {
    if (!isCleanActive) return;
    sweepCookieWalls();
    sweepChatWidgets();
    sweepSurveys();
    sweepNewsletterModals();
    sweepPaywallBlurs();
    sweepAntiAdblockWalls();
    sweepLoginWalls();
    sweepCustomSelectors();
    breakScrollLock();
    enforceAutoplayPolicy();
    enableSelectionAndCopy();
    attachUrlCleaner();
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
    chrome.storage.local.get(['settings'], (res) => {
      if (res && res.settings) {
        config = Object.assign(config, res.settings);
      }

      if (config.whitelistedDomains && config.whitelistedDomains.includes(currentHostname)) {
        isCleanActive = false;
        return;
      }

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
    });
  }

  // Handle messages from popup / options
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'getStatus') {
      sendResponse({
        enabled: isCleanActive,
        domain: currentHostname,
        blockedCount: blockedCount,
        settings: config
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

  startEngine();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeSweep);
  }
})();
