/**
 * BrowseClean - Options & Rules Manager (Minimalist Production Build)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const navLinks = document.querySelectorAll('.nav-link');
  const panes = document.querySelectorAll('.pane');

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.dataset.tab;
      navLinks.forEach(l => l.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });

  // Controls
  const optCookies = document.getElementById('opt-cookies');
  const optNewsletters = document.getElementById('opt-newsletters');
  const optChats = document.getElementById('opt-chats');
  const optUnblur = document.getElementById('opt-unblur');
  const optAntiAdblock = document.getElementById('opt-antiadblock');
  const optLoginWalls = document.getElementById('opt-loginwalls');
  const optCopy = document.getElementById('opt-copy');
  const optCleanUrls = document.getElementById('opt-cleanurls');
  const optViewport = document.getElementById('opt-viewport');
  const optScroll = document.getElementById('opt-scroll');
  const optAutoplay = document.getElementById('opt-autoplay');
  const optSurveys = document.getElementById('opt-surveys');

  const whitelistInput = document.getElementById('whitelistInput');
  const addWhitelistBtn = document.getElementById('addWhitelistBtn');
  const whitelistUl = document.getElementById('whitelistUl');

  const ruleDomainInput = document.getElementById('ruleDomainInput');
  const ruleSelectorInput = document.getElementById('ruleSelectorInput');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const rulesUl = document.getElementById('rulesUl');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFileInput');
  const resetBtn = document.getElementById('resetBtn');

  let currentSettings = {
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

  function loadSettings() {
    chrome.storage.local.get(['settings'], (res) => {
      if (res && res.settings) {
        currentSettings = Object.assign(currentSettings, res.settings);
      }

      optCookies.checked = !!currentSettings.blockCookies;
      optNewsletters.checked = !!currentSettings.blockNewsletters;
      optChats.checked = !!currentSettings.blockChats;
      if (optUnblur) optUnblur.checked = !!currentSettings.unblurContent;
      if (optAntiAdblock) optAntiAdblock.checked = !!currentSettings.blockAntiAdblock;
      if (optLoginWalls) optLoginWalls.checked = !!currentSettings.blockLoginWalls;
      if (optCopy) optCopy.checked = !!currentSettings.unlockCopy;
      if (optCleanUrls) optCleanUrls.checked = !!currentSettings.cleanUrls;
      if (optViewport) optViewport.checked = !!currentSettings.reclaimViewport;
      optScroll.checked = !!currentSettings.restoreScroll;
      optAutoplay.checked = !!currentSettings.stopAutoplay;
      optSurveys.checked = !!currentSettings.blockSurveys;

      renderWhitelist();
      renderCustomRules();
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ settings: currentSettings });
  }

  optCookies.addEventListener('change', () => { currentSettings.blockCookies = optCookies.checked; saveSettings(); });
  optNewsletters.addEventListener('change', () => { currentSettings.blockNewsletters = optNewsletters.checked; saveSettings(); });
  optChats.addEventListener('change', () => { currentSettings.blockChats = optChats.checked; saveSettings(); });
  if (optUnblur) optUnblur.addEventListener('change', () => { currentSettings.unblurContent = optUnblur.checked; saveSettings(); });
  if (optAntiAdblock) optAntiAdblock.addEventListener('change', () => { currentSettings.blockAntiAdblock = optAntiAdblock.checked; saveSettings(); });
  if (optLoginWalls) optLoginWalls.addEventListener('change', () => { currentSettings.blockLoginWalls = optLoginWalls.checked; saveSettings(); });
  if (optCopy) optCopy.addEventListener('change', () => { currentSettings.unlockCopy = optCopy.checked; saveSettings(); });
  if (optCleanUrls) optCleanUrls.addEventListener('change', () => { currentSettings.cleanUrls = optCleanUrls.checked; saveSettings(); });
  if (optViewport) optViewport.addEventListener('change', () => { currentSettings.reclaimViewport = optViewport.checked; saveSettings(); });
  optScroll.addEventListener('change', () => { currentSettings.restoreScroll = optScroll.checked; saveSettings(); });
  optAutoplay.addEventListener('change', () => { currentSettings.stopAutoplay = optAutoplay.checked; saveSettings(); });
  optSurveys.addEventListener('change', () => { currentSettings.blockSurveys = optSurveys.checked; saveSettings(); });

  // Whitelist Manager
  function renderWhitelist() {
    whitelistUl.innerHTML = '';
    const list = currentSettings.whitelistedDomains || [];
    if (!list.length) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'list-item';
      emptyLi.style.cssText = 'color: var(--text-muted); font-family: inherit;';
      emptyLi.textContent = 'No domains whitelisted.';
      whitelistUl.appendChild(emptyLi);
      return;
    }
    list.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'list-item';

      const span = document.createElement('span');
      span.textContent = domain;

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Remove';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        currentSettings.whitelistedDomains = currentSettings.whitelistedDomains.filter(d => d !== domain);
        saveSettings();
        renderWhitelist();
      });

      li.appendChild(span);
      li.appendChild(delBtn);
      whitelistUl.appendChild(li);
    });
  }

  addWhitelistBtn.addEventListener('click', () => {
    const raw = whitelistInput.value.trim().toLowerCase();
    const domain = raw.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    if (domain && !currentSettings.whitelistedDomains.includes(domain)) {
      currentSettings.whitelistedDomains.push(domain);
      saveSettings();
      renderWhitelist();
      whitelistInput.value = '';
    }
  });

  // Custom Rules Manager
  function renderCustomRules() {
    rulesUl.innerHTML = '';
    const rules = currentSettings.customSelectors || [];
    if (!rules.length) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'list-item';
      emptyLi.style.cssText = 'color: var(--text-muted); font-family: inherit;';
      emptyLi.textContent = 'No custom selectors configured.';
      rulesUl.appendChild(emptyLi);
      return;
    }
    rules.forEach((rule, idx) => {
      const li = document.createElement('li');
      li.className = 'list-item';

      const wrap = document.createElement('div');
      const domainSpan = document.createElement('span');
      domainSpan.style.cssText = 'color: var(--text-secondary); margin-right: 8px;';
      domainSpan.textContent = rule.domain || 'Global';

      const code = document.createElement('code');
      code.style.cssText = 'color: var(--accent-active);';
      code.textContent = rule.selector;

      wrap.appendChild(domainSpan);
      wrap.appendChild(code);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        currentSettings.customSelectors.splice(idx, 1);
        saveSettings();
        renderCustomRules();
      });

      li.appendChild(wrap);
      li.appendChild(delBtn);
      rulesUl.appendChild(li);
    });
  }

  addRuleBtn.addEventListener('click', () => {
    const domain = ruleDomainInput.value.trim().toLowerCase();
    const selector = ruleSelectorInput.value.trim();
    if (!selector) return;

    if (!currentSettings.customSelectors) {
      currentSettings.customSelectors = [];
    }
    currentSettings.customSelectors.push({ domain, selector });
    saveSettings();
    renderCustomRules();
    ruleDomainInput.value = '';
    ruleSelectorInput.value = '';
  });

  // Export JSON
  exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentSettings, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `browseclean-config-${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Import JSON
  importBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        currentSettings = Object.assign(currentSettings, imported);
        saveSettings();
        loadSettings();
      } catch (err) {
        alert('Invalid configuration file.');
      }
    };
    reader.readAsText(file);
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset BrowseClean to default configuration?')) {
      chrome.storage.local.clear(() => {
        location.reload();
      });
    }
  });

  loadSettings();
});
