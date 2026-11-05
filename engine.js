/**
 * BrowseClean - Core Content Engine (Production Grade)
 * Ultra-fast, zero-overhead DOM declutter and consent automation.
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

  // Configuration schema
  let config = {
    blockCookies: true,
    blockNewsletters: true,
    blockChats: true,
    restoreScroll: true,
    stopAutoplay: true,
    blockNotifications: true,
    blockSurveys: true,
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

  // Scroll lock classes to neutralize
  const LOCK_CLASSES = [
    'sp-message-open',
    'didomi-popup-open',
    'modal-open',
    'no-scroll',
    'has-modal',
    'overflow-hidden',
    'prevent-scroll',
    'is-locked'
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

    // A. Smart Reject Button Hunter
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

    // B. Selectors sweep
    CMP_CONTAINERS.forEach(selector => {
      try {
        const matches = document.querySelectorAll(selector);
        matches.forEach(el => {
          eradicateElement(el, 'cookie-cmp');
        });
      } catch (e) {}
    });

    // C. Remove any orphaned veils or backdrops
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

    // Specific promo selectors
    const promos = document.querySelectorAll('#desktop-dynamic-upsell-dialog, .desktop-dynamic-upsell-dialog, div[id^="om-"], div[class*="om-holder"], #privy-container, .klaviyo-form, .sumo-popup, .upsell-modal');
    promos.forEach(p => eradicateElement(p, 'promo'));

    // Heuristic scan for modals containing email inputs
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
              // Also eradicate its backdrop
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
   * 5. Custom User Selectors
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
   * 6. Scroll Lock Breaker
   */
  function breakScrollLock() {
    if (!config.restoreScroll) return;

    const html = document.documentElement;
    const body = document.body;
    if (!html) return;

    // Remove lock classes
    LOCK_CLASSES.forEach(cls => {
      if (html.classList.contains(cls)) html.classList.remove(cls);
      if (body && body.classList.contains(cls)) body.classList.remove(cls);
    });

    // Check inline and computed overflow styles
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
   * 7. Autoplay Video Management
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
   * Main Pipeline execution
   */
  function executeSweep() {
    if (!isCleanActive) return;
    sweepCookieWalls();
    sweepChatWidgets();
    sweepSurveys();
    sweepNewsletterModals();
    sweepCustomSelectors();
    breakScrollLock();
    enforceAutoplayPolicy();
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

      // Check domain whitelist
      if (config.whitelistedDomains && config.whitelistedDomains.includes(currentHostname)) {
        isCleanActive = false;
        return;
      }

      // Execute initial sweep immediately
      executeSweep();

      // Hook observer to document root
      const root = document.documentElement || document;
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });

      // Periodic sweeps for late-loading scripts during first 10 seconds
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

  // Start engine as early as possible
  startEngine();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeSweep);
  }
})();
