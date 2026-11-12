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

  const toggleCookies = document.getElementById('toggleCookies');
  const toggleNewsletters = document.getElementById('toggleNewsletters');
  const toggleChats = document.getElementById('toggleChats');
  const toggleUnblur = document.getElementById('toggleUnblur');
  const toggleAntiAdblock = document.getElementById('toggleAntiAdblock');
  const toggleLoginWalls = document.getElementById('toggleLoginWalls');
  const toggleCopy = document.getElementById('toggleCopy');
  const toggleCleanUrls = document.getElementById('toggleCleanUrls');
  const toggleViewport = document.getElementById('toggleViewport');
  const toggleScroll = document.getElementById('toggleScroll');
  const toggleAutoplay = document.getElementById('toggleAutoplay');
  const toggleSurveys = document.getElementById('toggleSurveys');
  const enterpriseBanner = document.getElementById('enterpriseBanner');

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
    restoreScroll: toggleScroll,
    stopAutoplay: toggleAutoplay,
    blockSurveys: toggleSurveys
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
        if (lockedKeys.includes(key)) {
          el.disabled = true;
          const row = el.closest('.filter-row');
          if (row) {
            row.classList.add('locked');
            row.title = 'Enforced by organization policy';
          }
        }
      }
    });

    const isWhitelisted = activeSettings.whitelistedDomains && activeSettings.whitelistedDomains.includes(activeHostname);
    siteToggle.checked = !isWhitelisted;
    renderStatusBadge(!isWhitelisted);

    if (lockedKeys.includes('whitelistedDomains') || (isManaged && isWhitelisted)) {
      siteToggle.disabled = true;
      const domainCard = siteToggle.closest('.domain-card');
      if (domainCard) domainCard.title = 'Domain exemption enforced by organization policy';
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
  toggleCookies.addEventListener('change', () => { activeSettings.blockCookies = toggleCookies.checked; persistSettings(); });
  toggleNewsletters.addEventListener('change', () => { activeSettings.blockNewsletters = toggleNewsletters.checked; persistSettings(); });
  toggleChats.addEventListener('change', () => { activeSettings.blockChats = toggleChats.checked; persistSettings(); });
  toggleUnblur.addEventListener('change', () => { activeSettings.unblurContent = toggleUnblur.checked; persistSettings(); });
  if (toggleAntiAdblock) toggleAntiAdblock.addEventListener('change', () => { activeSettings.blockAntiAdblock = toggleAntiAdblock.checked; persistSettings(); });
  if (toggleLoginWalls) toggleLoginWalls.addEventListener('change', () => { activeSettings.blockLoginWalls = toggleLoginWalls.checked; persistSettings(); });
  toggleCopy.addEventListener('change', () => { activeSettings.unlockCopy = toggleCopy.checked; persistSettings(); });
  toggleCleanUrls.addEventListener('change', () => { activeSettings.cleanUrls = toggleCleanUrls.checked; persistSettings(); });
  if (toggleViewport) toggleViewport.addEventListener('change', () => { activeSettings.reclaimViewport = toggleViewport.checked; persistSettings(); });
  toggleScroll.addEventListener('change', () => { activeSettings.restoreScroll = toggleScroll.checked; persistSettings(); });
  toggleAutoplay.addEventListener('change', () => { activeSettings.stopAutoplay = toggleAutoplay.checked; persistSettings(); });
  toggleSurveys.addEventListener('change', () => { activeSettings.blockSurveys = toggleSurveys.checked; persistSettings(); });

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
