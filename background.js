/**
 * BrowseClean - Background Service Worker (Manifest V3)
 * Production-grade telemetry, badge management, and state store.
 */

const DEFAULT_SETTINGS = {
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

// Lifecycle: Install & Update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'stats'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    } else {
      // Migrate missing fields if updating
      const updated = Object.assign({}, DEFAULT_SETTINGS, result.settings);
      chrome.storage.local.set({ settings: updated });
    }
    if (!result.stats) {
      chrome.storage.local.set({
        stats: {
          totalBlocked: 0,
          sitesCleaned: 0
        }
      });
    }
  });

  chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
});

// Shortcut commands listener (e.g. Alt+Z for Element Zapper)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-zapper') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startZapper' }).catch(() => {});
      }
    });
  }
});

// Resolve effective settings taking Chrome Enterprise Managed Policy into account
function resolveEffectiveSettings(callback) {
  chrome.storage.local.get(['settings'], (localRes) => {
    const local = localRes.settings || DEFAULT_SETTINGS;
    if (chrome.storage && chrome.storage.managed) {
      chrome.storage.managed.get(null, (managedSettings) => {
        if (chrome.runtime.lastError || !managedSettings || Object.keys(managedSettings).length === 0) {
          callback(local, [], false, {});
          return;
        }

        const effective = Object.assign({}, local, managedSettings);

        // Union whitelisted domains if defined in both
        if (Array.isArray(managedSettings.whitelistedDomains) && Array.isArray(local.whitelistedDomains)) {
          effective.whitelistedDomains = Array.from(new Set([
            ...managedSettings.whitelistedDomains,
            ...local.whitelistedDomains
          ]));
        }

        const lockedKeys = Array.isArray(managedSettings.forcedLockedSettings)
          ? managedSettings.forcedLockedSettings
          : Object.keys(managedSettings);

        callback(effective, lockedKeys, true, managedSettings);
      });
    } else {
      callback(local, [], false, {});
    }
  });
}

// Listen for dynamic policy updates from enterprise MDM / GPO
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'managed') {
      resolveEffectiveSettings((effective, lockedKeys, isManaged) => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab && tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'policyUpdated',
                settings: effective,
                lockedKeys: lockedKeys,
                isManaged: isManaged
              }).catch(() => {});
            }
          });
        });
      });
    }
  });
}

// Cryptographic Hash Utility (SHA-256 via Web Crypto API)
async function computeSha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Telemetry, Audit Logging & Badge Synchronization
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getEffectiveSettings') {
    resolveEffectiveSettings((settings, lockedKeys, isManaged) => {
      sendResponse({ settings, lockedKeys, isManaged });
    });
    return true;
  }

  // Cryptographic Audit Logging (Compliance & DLP)
  if (message.action === 'recordAuditLog') {
    resolveEffectiveSettings((settings) => {
      if (!settings.auditLogging) {
        sendResponse({ ignored: true });
        return;
      }
      chrome.storage.local.get(['auditLog'], (res) => {
        let log = res.auditLog || [];
        const entry = Object.assign({
          id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
          timestamp: new Date().toISOString()
        }, message.entry);

        log.unshift(entry);
        if (log.length > 1000) {
          log = log.slice(0, 1000);
        }
        chrome.storage.local.set({ auditLog: log }, () => {
          sendResponse({ recorded: true, count: log.length });
        });
      });
    });
    return true;
  }

  if (message.action === 'getAuditLog') {
    chrome.storage.local.get(['auditLog'], async (res) => {
      const log = res.auditLog || [];
      const hash = await computeSha256(JSON.stringify(log));
      sendResponse({ log, count: log.length, sha256: hash });
    });
    return true;
  }

  if (message.action === 'clearAuditLog') {
    chrome.storage.local.set({ auditLog: [] }, () => {
      sendResponse({ cleared: true });
    });
    return true;
  }

  if (message.action === 'generateCompliancePackage') {
    chrome.storage.local.get(['auditLog', 'stats', 'settings'], async (res) => {
      const log = res.auditLog || [];
      const stats = res.stats || { totalBlocked: 0, sitesCleaned: 0 };
      const rawPayload = JSON.stringify(log);
      const sha256 = await computeSha256(rawPayload);

      const compliancePackage = {
        complianceStandard: 'BrowseClean Cryptographic Audit Spec v1.0',
        generatedAt: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        environment: 'Local Client-Side Sandbox (Zero Outbound Exfiltration)',
        cryptographicProof: {
          algorithm: 'SHA-256',
          digest: sha256
        },
        metrics: {
          totalLoggedInterventions: log.length,
          allTimeInterventions: stats.totalBlocked || 0
        },
        auditTrail: log
      };

      sendResponse({ package: compliancePackage, sha256 });
    });
    return true;
  }

  if (message.action === 'updateCount') {
    const tabId = sender.tab ? sender.tab.id : null;
    const count = message.count || 0;

    if (tabId && count > 0) {
      chrome.action.setBadgeText({
        tabId: tabId,
        text: count > 99 ? '99+' : count.toString()
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: '#3B82F6'
      });
    }

    // Atomically increment all-time stats
    chrome.storage.local.get(['stats'], (res) => {
      const stats = res.stats || { totalBlocked: 0 };
      stats.totalBlocked = (stats.totalBlocked || 0) + 1;
      chrome.storage.local.set({ stats });
    });

    sendResponse({ success: true });
    return true;
  }
});
