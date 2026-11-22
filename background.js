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
  enforceWebRtcPolicy();
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

// WebRTC Zero-Trust Network Defense: Chromium Socket-Level IP Policy
function syncWebRtcHandlingPolicy(enabled) {
  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
    const targetValue = enabled ? 'default_public_interface_only' : 'default';
    chrome.privacy.network.webRTCIPHandlingPolicy.get({}, (details) => {
      if (details && details.value !== targetValue && details.levelOfControl !== 'not_controllable') {
        chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: targetValue }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[BrowseClean] WebRTC socket policy enforcement error:', chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
}

function enforceWebRtcPolicy() {
  resolveEffectiveSettings((effective) => {
    syncWebRtcHandlingPolicy(!!effective.blockWebRtcLeak);
  });
}

// Initial WebRTC socket policy verification at worker startup
enforceWebRtcPolicy();

// Listen for dynamic policy updates from enterprise MDM / GPO and local storage
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'managed') {
      resolveEffectiveSettings((effective, lockedKeys, isManaged) => {
        syncWebRtcHandlingPolicy(!!effective.blockWebRtcLeak);
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
    } else if (area === 'local' && changes.settings) {
      resolveEffectiveSettings((effective) => {
        syncWebRtcHandlingPolicy(!!effective.blockWebRtcLeak);
      });
    }
  });
}

// Cryptographic Hash Utility & Merkle-Chain Engine (SHA-256 via Web Crypto API)
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

async function computeSha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyAuditLogChain(log) {
  if (!Array.isArray(log) || log.length === 0) {
    return {
      valid: true,
      chainLength: 0,
      rootHash: GENESIS_HASH,
      tamperedIndex: -1,
      reason: 'Genesis state: 0 events recorded'
    };
  }

  // log[0] is newest block, log[log.length - 1] is oldest
  const reversed = [...log].reverse();
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < reversed.length; i++) {
    const item = reversed[i];
    if (!item.entryHash || !item.prevHash) {
      continue;
    }

    if (i > 0 && item.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        chainLength: i,
        rootHash: item.entryHash,
        tamperedIndex: log.length - 1 - i,
        reason: `Broken chain link at block #${item.sequence}: prevHash does not match previous block hash`
      };
    }

    const payload = `${item.sequence}|${item.timestamp}|${item.domain}|${item.category}|${item.action}|${item.details || ''}|${item.prevHash}`;
    const calculatedHash = await computeSha256(payload);

    if (calculatedHash !== item.entryHash) {
      return {
        valid: false,
        chainLength: i,
        rootHash: item.entryHash,
        tamperedIndex: log.length - 1 - i,
        reason: `Tampered content at block #${item.sequence}: cryptographic signature mismatch`
      };
    }

    expectedPrevHash = item.entryHash;
  }

  return {
    valid: true,
    chainLength: log.length,
    rootHash: log[0].entryHash || (await computeSha256(JSON.stringify(log))),
    tamperedIndex: -1,
    reason: `All ${log.length} blocks verified against sequential SHA-256 hash chain`
  };
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
      chrome.storage.local.get(['auditLog'], async (res) => {
        let log = res.auditLog || [];
        const prevHash = (log.length > 0 && log[0].entryHash) ? log[0].entryHash : GENESIS_HASH;
        const sequence = (log.length > 0 && typeof log[0].sequence === 'number') ? log[0].sequence + 1 : (log.length + 1);
        const timestamp = new Date().toISOString();
        const domain = (message.entry && message.entry.domain) ? message.entry.domain : '';
        const category = (message.entry && message.entry.category) ? message.entry.category : 'general';
        const action = (message.entry && message.entry.action) ? message.entry.action : 'intervene';
        const details = (message.entry && message.entry.details) ? message.entry.details : '';

        const payload = `${sequence}|${timestamp}|${domain}|${category}|${action}|${details}|${prevHash}`;
        const entryHash = await computeSha256(payload);

        const chainedEntry = {
          sequence: sequence,
          id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
          timestamp: timestamp,
          domain: domain,
          category: category,
          action: action,
          details: details,
          prevHash: prevHash,
          entryHash: entryHash
        };

        log.unshift(chainedEntry);
        if (log.length > 1000) {
          log = log.slice(0, 1000);
        }
        chrome.storage.local.set({ auditLog: log, auditRootHash: entryHash }, () => {
          sendResponse({ recorded: true, count: log.length, rootHash: entryHash });
        });
      });
    });
    return true;
  }

  if (message.action === 'getAuditLog') {
    chrome.storage.local.get(['auditLog'], async (res) => {
      const log = res.auditLog || [];
      const verification = await verifyAuditLogChain(log);
      sendResponse({
        log: log,
        count: log.length,
        sha256: verification.rootHash,
        rootHash: verification.rootHash,
        verification: verification
      });
    });
    return true;
  }

  if (message.action === 'verifyAuditLog') {
    chrome.storage.local.get(['auditLog'], async (res) => {
      const log = res.auditLog || [];
      const verification = await verifyAuditLogChain(log);
      sendResponse({ verification: verification });
    });
    return true;
  }

  if (message.action === 'clearAuditLog') {
    chrome.storage.local.set({ auditLog: [], auditRootHash: GENESIS_HASH }, () => {
      sendResponse({ cleared: true });
    });
    return true;
  }

  if (message.action === 'generateCompliancePackage') {
    chrome.storage.local.get(['auditLog', 'stats', 'settings'], async (res) => {
      const log = res.auditLog || [];
      const stats = res.stats || { totalBlocked: 0, sitesCleaned: 0 };
      const verification = await verifyAuditLogChain(log);

      const compliancePackage = {
        complianceStandard: 'BrowseClean Cryptographic Audit Spec v2.0 (Merkle-Chain Ledger)',
        generatedAt: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        environment: 'Local Client-Side Sandbox (Zero Outbound Exfiltration)',
        cryptographicProof: {
          algorithm: 'SHA-256',
          architecture: 'Sequential Hash-Chained Audit Ledger',
          genesisHash: GENESIS_HASH,
          chainRootHash: verification.rootHash,
          chainIntegrityVerified: verification.valid,
          verifiedBlockCount: verification.chainLength
        },
        metrics: {
          totalLoggedInterventions: log.length,
          allTimeInterventions: stats.totalBlocked || 0
        },
        auditTrail: log
      };

      sendResponse({ package: compliancePackage, sha256: verification.rootHash, verification: verification });
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

  if (message.action === 'getEnterpriseDiagnostics') {
    resolveEffectiveSettings(async (settings, lockedKeys, isManaged, managedSettings) => {
      const extensionId = chrome.runtime.id;
      const schemaKeys = [
        'blockCookies', 'blockNewsletters', 'blockChats', 'restoreScroll',
        'stopAutoplay', 'blockNotifications', 'blockSurveys', 'unblurContent',
        'unlockCopy', 'cleanUrls', 'blockAntiAdblock', 'blockLoginWalls',
        'reclaimViewport', 'blockSessionSpies', 'auditLogging', 'antiTamperDlp',
        'blockWebRtcLeak', 'blockPhishingSpoofs', 'clipboardDlp'
      ];
      const payloadToHash = JSON.stringify({ settings, lockedKeys, isManaged });
      const policyHash = await computeSha256(payloadToHash);

      let webRtcPolicy = 'unsupported';
      if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
        try {
          const details = await new Promise((resolve) => {
            chrome.privacy.network.webRTCIPHandlingPolicy.get({}, resolve);
          });
          webRtcPolicy = (details && details.value) ? details.value : 'unknown';
        } catch (e) {
          webRtcPolicy = 'error';
        }
      }

      sendResponse({
        isManaged: isManaged,
        managedSettings: managedSettings || {},
        lockedKeys: lockedKeys || [],
        policyHash: policyHash,
        totalSchemaKeys: schemaKeys.length,
        schemaKeys: schemaKeys,
        extensionId: extensionId,
        settings: settings,
        webRtcPolicy: webRtcPolicy
      });
    });
    return true;
  }
});
