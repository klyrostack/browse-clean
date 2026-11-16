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
  const optSessionSpies = document.getElementById('opt-sessionspies');
  const optAudit = document.getElementById('opt-audit');
  const optAntiTamper = document.getElementById('opt-antitamper');
  const optWebRtc = document.getElementById('opt-webrtc');
  const optScroll = document.getElementById('opt-scroll');
  const optAutoplay = document.getElementById('opt-autoplay');
  const optSurveys = document.getElementById('opt-surveys');
  const enterpriseStatus = document.getElementById('enterpriseStatus');

  const auditCountVal = document.getElementById('auditCountVal');
  const auditHashVal = document.getElementById('auditHashVal');
  const exportComplianceJsonBtn = document.getElementById('exportComplianceJsonBtn');
  const exportComplianceCsvBtn = document.getElementById('exportComplianceCsvBtn');
  const clearAuditLogBtn = document.getElementById('clearAuditLogBtn');

  let lockedKeys = [];
  let isManaged = false;

  const optMap = {
    blockCookies: optCookies,
    blockNewsletters: optNewsletters,
    blockChats: optChats,
    unblurContent: optUnblur,
    blockAntiAdblock: optAntiAdblock,
    blockLoginWalls: optLoginWalls,
    unlockCopy: optCopy,
    cleanUrls: optCleanUrls,
    reclaimViewport: optViewport,
    blockSessionSpies: optSessionSpies,
    auditLogging: optAudit,
    antiTamperDlp: optAntiTamper,
    blockWebRtcLeak: optWebRtc,
    restoreScroll: optScroll,
    stopAutoplay: optAutoplay,
    blockSurveys: optSurveys
  };

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
    blockSessionSpies: true,
    auditLogging: true,
    antiTamperDlp: true,
    blockWebRtcLeak: true,
    whitelistedDomains: [],
    customSelectors: []
  };

  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getEffectiveSettings' }, (res) => {
      if (res && res.settings) {
        currentSettings = Object.assign(currentSettings, res.settings);
        lockedKeys = res.lockedKeys || [];
        isManaged = !!res.isManaged;
      }

      if (isManaged && enterpriseStatus) {
        enterpriseStatus.style.display = 'flex';
      }

      Object.keys(optMap).forEach(key => {
        const el = optMap[key];
        if (el) {
          el.checked = !!currentSettings[key];
          if (lockedKeys.includes(key)) {
            el.disabled = true;
            const row = el.closest('.row');
            if (row) {
              row.classList.add('locked');
              row.title = 'Enforced by enterprise policy';
              const titleEl = row.querySelector('.row-title');
              if (titleEl && !titleEl.querySelector('.badge-managed')) {
                const badge = document.createElement('span');
                badge.className = 'badge-managed';
                badge.textContent = 'Managed';
                titleEl.appendChild(badge);
              }
            }
          }
        }
      });

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
  if (optSessionSpies) optSessionSpies.addEventListener('change', () => { currentSettings.blockSessionSpies = optSessionSpies.checked; saveSettings(); });
  if (optAudit) optAudit.addEventListener('change', () => { currentSettings.auditLogging = optAudit.checked; saveSettings(); });
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

      if (isManaged && lockedKeys.includes('whitelistedDomains')) {
        li.classList.add('managed-item');
        const badge = document.createElement('span');
        badge.className = 'badge-managed';
        badge.textContent = 'Enforced';
        span.appendChild(badge);
      } else {
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.title = 'Remove';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', () => {
          currentSettings.whitelistedDomains = currentSettings.whitelistedDomains.filter(d => d !== domain);
          saveSettings();
          renderWhitelist();
        });
        li.appendChild(delBtn);
      }

      li.appendChild(span);
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

  // Cryptographic Audit & Compliance Management
  function loadAuditMetrics() {
    chrome.runtime.sendMessage({ action: 'getAuditLog' }, (res) => {
      if (res) {
        if (auditCountVal) auditCountVal.textContent = (res.count || 0).toLocaleString();
        if (auditHashVal) {
          if (res.count > 0 && res.sha256) {
            auditHashVal.textContent = res.sha256.slice(0, 16) + '...' + res.sha256.slice(-8);
            auditHashVal.title = res.sha256;
          } else {
            auditHashVal.textContent = 'Verified Clean (0 Events)';
          }
        }
      }
    });
  }

  if (exportComplianceJsonBtn) {
    exportComplianceJsonBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'generateCompliancePackage' }, (res) => {
        if (!res || !res.package) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.package, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", `browseclean-compliance-audit-${Date.now()}.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    });
  }

  if (exportComplianceCsvBtn) {
    exportComplianceCsvBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'getAuditLog' }, (res) => {
        const log = (res && res.log) ? res.log : [];
        const headers = ['Timestamp', 'Domain', 'Category', 'Action', 'Details'];
        const csvRows = [headers.join(',')];

        log.forEach(item => {
          const row = [
            `"${(item.timestamp || '').replace(/"/g, '""')}"`,
            `"${(item.domain || '').replace(/"/g, '""')}"`,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            `"${(item.action || '').replace(/"/g, '""')}"`,
            `"${(item.details || '').replace(/"/g, '""')}"`
          ];
          csvRows.push(row.join(','));
        });

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join('\n'));
        const a = document.createElement('a');
        a.setAttribute("href", csvContent);
        a.setAttribute("download", `browseclean-audit-log-${Date.now()}.csv`);
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    });
  }

  if (clearAuditLogBtn) {
    clearAuditLogBtn.addEventListener('click', () => {
      if (confirm('Permanently clear all local cryptographic audit records?')) {
        chrome.runtime.sendMessage({ action: 'clearAuditLog' }, () => {
          loadAuditMetrics();
        });
      }
    });
  }

  loadSettings();
  loadAuditMetrics();
});
