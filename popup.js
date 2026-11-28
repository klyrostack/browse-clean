/**
 * BrowseClean - Popup Controller (Minimalist Production Build)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentDomainEl = document.getElementById('currentDomain');
  const domainStatusEl = document.getElementById('domainStatus');
  const siteToggle = document.getElementById('siteToggle');
  const pageCountEl = document.getElementById('pageCount');
  const totalCountEl = document.getElementById('totalCount');
  const manualSweepBtn = document.getElementById('manualSweepBtn');
  const startZapperBtn = document.getElementById('startZapperBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const prepaintPerfText = document.getElementById('prepaintPerfText');

  const toggleCookies = document.getElementById('toggleCookies');
  const toggleNewsletters = document.getElementById('toggleNewsletters');
  const toggleChats = document.getElementById('toggleChats');
  const toggleUnblur = document.getElementById('toggleUnblur');
  const toggleAntiAdblock = document.getElementById('toggleAntiAdblock');
  const toggleLoginWalls = document.getElementById('toggleLoginWalls');
  const toggleCopy = document.getElementById('toggleCopy');
  const toggleCleanUrls = document.getElementById('toggleCleanUrls');
  const toggleViewport = document.getElementById('toggleViewport');
  const toggleSessionSpies = document.getElementById('toggleSessionSpies');
  const toggleAudit = document.getElementById('toggleAudit');
  const toggleAntiTamper = document.getElementById('toggleAntiTamper');
  const toggleWebRtc = document.getElementById('toggleWebRtc');
  const togglePhishing = document.getElementById('togglePhishing');
  const toggleClipboardDlp = document.getElementById('toggleClipboardDlp');
  const toggleScroll = document.getElementById('toggleScroll');
  const toggleAutoplay = document.getElementById('toggleAutoplay');
  const toggleSurveys = document.getElementById('toggleSurveys');
  const toggleNotifications = document.getElementById('toggleNotifications');
  const toggleDeclarativeSupplyChain = document.getElementById('toggleDeclarativeSupplyChain');
  const toggleCspHardening = document.getElementById('toggleCspHardening');
  const enterpriseBanner = document.getElementById('enterpriseBanner');

  const PAM_PROTECTED_KEYS = new Set([
    'blockSessionSpies',
    'auditLogging',
    'antiTamperDlp',
    'blockWebRtcLeak',
    'blockPhishingSpoofs',
    'clipboardDlp',
    'declarativeSupplyChain',
    'dynamicCspHardening'
  ]);

  const toggleMap = {
    blockCookies: toggleCookies,
    blockNewsletters: toggleNewsletters,
    blockChats: toggleChats,
    unblurContent: toggleUnblur,
    blockAntiAdblock: toggleAntiAdblock,
    blockLoginWalls: toggleLoginWalls,
    unlockCopy: toggleCopy,
    cleanUrls: toggleCleanUrls,
    reclaimViewport: toggleViewport,
    blockSessionSpies: toggleSessionSpies,
    auditLogging: toggleAudit,
    antiTamperDlp: toggleAntiTamper,
    blockWebRtcLeak: toggleWebRtc,
    blockPhishingSpoofs: togglePhishing,
    clipboardDlp: toggleClipboardDlp,
    declarativeSupplyChain: toggleDeclarativeSupplyChain,
    dynamicCspHardening: toggleCspHardening,
    restoreScroll: toggleScroll,
    stopAutoplay: toggleAutoplay,
    blockSurveys: toggleSurveys,
    blockNotifications: toggleNotifications
  };

  let activeTab = null;
  let activeHostname = '';
  let activeSettings = {
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
    declarativeSupplyChain: true,
    dynamicCspHardening: true,
    cspMode: 'standard',
    webAuthnAdminLock: false,
    whitelistedDomains: [],
    customSelectors: []
  };

  // Resolve current active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    activeTab = tabs[0];
    try {
      const url = new URL(activeTab.url);
      if (url.protocol.startsWith('http')) {
        activeHostname = url.hostname.toLowerCase();
        currentDomainEl.textContent = activeHostname;
      } else {
        currentDomainEl.textContent = 'System Page';
        siteToggle.disabled = true;
        if (startZapperBtn) startZapperBtn.disabled = true;
      }
    } catch (e) {
      currentDomainEl.textContent = 'Unknown Page';
      siteToggle.disabled = true;
    }
  }

  // Load stored settings and stats taking enterprise managed policy into account
  chrome.runtime.sendMessage({ action: 'getEffectiveSettings' }, (effectiveRes) => {
    let lockedKeys = [];
    let isManaged = false;

    if (effectiveRes && effectiveRes.settings) {
      activeSettings = Object.assign(activeSettings, effectiveRes.settings);
      lockedKeys = effectiveRes.lockedKeys || [];
      isManaged = !!effectiveRes.isManaged;
    }

    if (isManaged && enterpriseBanner) {
      enterpriseBanner.style.display = 'flex';
    }

    Object.keys(toggleMap).forEach(key => {
      const el = toggleMap[key];
      if (el) {
        el.checked = !!activeSettings[key];
        const isEnterpriseLocked = lockedKeys.includes(key);
        const isPamLocked = !!activeSettings.webAuthnAdminLock && PAM_PROTECTED_KEYS.has(key);
        if (isEnterpriseLocked || isPamLocked) {
          el.disabled = true;
          const row = el.closest('.filter-row');
          if (row) {
            row.classList.add('locked');
            row.title = isEnterpriseLocked
              ? 'Enforced by organization policy'
              : 'Protected by Admin PAM Lock — modify in Settings';
          }
        }
      }
    });

    const isWhitelisted = activeSettings.whitelistedDomains && activeSettings.whitelistedDomains.includes(activeHostname);
    siteToggle.checked = !isWhitelisted;
    renderStatusBadge(!isWhitelisted);

    if (lockedKeys.includes('whitelistedDomains') || (isManaged && isWhitelisted) || activeSettings.webAuthnAdminLock) {
      siteToggle.disabled = true;
      const domainCard = siteToggle.closest('.domain-card');
      if (domainCard) {
        domainCard.title = activeSettings.webAuthnAdminLock && !isManaged
          ? 'Protected by Admin PAM Lock — modify in Settings'
          : 'Domain exemption enforced by organization policy';
      }
    }
  });

  chrome.storage.local.get(['stats'], (result) => {
    if (result && result.stats && typeof result.stats.totalBlocked === 'number') {
      totalCountEl.textContent = result.stats.totalBlocked.toLocaleString();
    }
  });

  // Query content script for page-level stats
  if (activeTab && activeTab.id) {
    chrome.tabs.sendMessage(activeTab.id, { action: 'getStatus' }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        pageCountEl.textContent = '0';
        return;
      }
      pageCountEl.textContent = (resp.blockedCount || 0).toString();
      renderStatusBadge(resp.enabled);
      if (resp.prepaintMetrics && prepaintPerfText) {
        const ms = resp.prepaintMetrics.prepaintDurationMs || 0.4;
        prepaintPerfText.textContent = `Zero-FOUC Active (${ms}ms prepaint)`;
      }
    });
  }

  function renderStatusBadge(isActive) {
    if (isActive) {
      domainStatusEl.textContent = 'Active';
      domainStatusEl.className = 'domain-status';
    } else {
      domainStatusEl.textContent = 'Paused';
      domainStatusEl.className = 'domain-status disabled';
    }
  }

  function persistSettings() {
    chrome.storage.local.set({ settings: activeSettings });
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        action: 'updateSettings',
        settings: activeSettings
      }, (res) => {
        if (!chrome.runtime.lastError && res) {
          renderStatusBadge(res.enabled);
        }
      });
    }
  }

  // Whitelist toggle
  siteToggle.addEventListener('change', () => {
    const isProtected = siteToggle.checked;
    renderStatusBadge(isProtected);

    if (!activeSettings.whitelistedDomains) {
      activeSettings.whitelistedDomains = [];
    }

    if (isProtected) {
      activeSettings.whitelistedDomains = activeSettings.whitelistedDomains.filter(d => d !== activeHostname);
    } else {
      if (activeHostname && !activeSettings.whitelistedDomains.includes(activeHostname)) {
        activeSettings.whitelistedDomains.push(activeHostname);
      }
    }

    persistSettings();
  });

  // Module switches
  Object.keys(toggleMap).forEach((key) => {
    const el = toggleMap[key];
    if (!el) return;
    el.addEventListener('change', () => {
      activeSettings[key] = el.checked;
      persistSettings();
    });
  });

  // Manual Sweep
  manualSweepBtn.addEventListener('click', () => {
    if (!activeTab || !activeTab.id) return;
    const defaultText = manualSweepBtn.textContent;
    manualSweepBtn.textContent = 'Sweeping...';

    chrome.tabs.sendMessage(activeTab.id, { action: 'manualSweep' }, (res) => {
      setTimeout(() => {
        manualSweepBtn.textContent = 'Sweep Complete';
        if (res && typeof res.count === 'number') {
          pageCountEl.textContent = res.count.toString();
        }
        setTimeout(() => {
          manualSweepBtn.textContent = defaultText;
        }, 1200);
      }, 200);
    });
  });

  // Start Zapper
  startZapperBtn.addEventListener('click', () => {
    if (!activeTab || !activeTab.id) return;
    chrome.tabs.sendMessage(activeTab.id, { action: 'startZapper' });
    window.close(); // Close popup window so user can click elements on page directly
  });

  // Settings
  openOptionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
});
