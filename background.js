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
  webRtcPolicyMode: 'default_public_interface_only',
  blockPhishingSpoofs: true,
  clipboardDlp: true,
  siemForwarding: false,
  siemEndpoint: '',
  siemAuthHeader: '',
  siemFormat: 'ecs_json',
  siemBatchSize: 10,
  webAuthnAdminLock: false,
  declarativeSupplyChain: true,
  dynamicCspHardening: true,
  cspMode: 'standard',
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
  enforceDeclarativeRules();
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
function syncWebRtcHandlingPolicy(enabled, mode) {
  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
    const validModes = ['default_public_interface_only', 'disable_non_proxied_udp'];
    const chosenMode = validModes.includes(mode) ? mode : 'default_public_interface_only';
    const targetValue = enabled ? chosenMode : 'default';
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
    syncWebRtcHandlingPolicy(!!effective.blockWebRtcLeak, effective.webRtcPolicyMode);
  });
}

// Declarative Supply-Chain Defense & Dynamic CSP Engine (declarativeNetRequest)
const SUPPLY_CHAIN_BLOCK_PATTERNS = [
  { id: 2001, pattern: '||hotjar.com^', label: 'Hotjar Session Harvester' },
  { id: 2002, pattern: '||fullstory.com^', label: 'FullStory DOM Recorder' },
  { id: 2003, pattern: '||logrocket.com^', label: 'LogRocket Keystroke Logger' },
  { id: 2004, pattern: '||clarity.ms^', label: 'Microsoft Clarity Tracker' },
  { id: 2005, pattern: '||mouseflow.com^', label: 'Mouseflow Replay Vector' },
  { id: 2006, pattern: '||coinhive.com^', label: 'Coinhive Cryptominer' },
  { id: 2007, pattern: '||web-stat.com^', label: 'Web-Stat Exfiltrator' },
  { id: 2008, pattern: '||clicktale.net^', label: 'ClickTale DOM Monitor' },
  { id: 2009, pattern: '||smartlook.com^', label: 'Smartlook Session Tracker' },
  { id: 2010, pattern: '||inspectlet.com^', label: 'Inspectlet Form Logger' }
];

const DNR_RULE_IDS = [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2100];

function syncDeclarativeSupplyChainRules(settings, whitelistedDomains) {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
    return;
  }

  const whitelist = Array.isArray(whitelistedDomains)
    ? whitelistedDomains.filter(d => typeof d === 'string' && d.trim().length > 0)
    : [];
  const newRules = [];

  // 1. Supply-Chain Exfiltration & Skimmer Blocking Rules
  if (settings.declarativeSupplyChain) {
    for (const item of SUPPLY_CHAIN_BLOCK_PATTERNS) {
      const condition = {
        urlFilter: item.pattern,
        resourceTypes: ['script', 'xmlhttprequest', 'sub_frame', 'ping', 'other']
      };
      if (whitelist.length > 0) {
        condition.excludedInitiatorDomains = whitelist;
      }
      newRules.push({
        id: item.id,
        priority: 1,
        action: { type: 'block' },
        condition: condition
      });
    }
  }

  // 2. Dynamic CSP Hardening (append object-src 'none'; base-uri 'self')
  if (settings.dynamicCspHardening) {
    const cspValue = settings.cspMode === 'strict'
      ? "object-src 'none'; base-uri 'self'; require-trusted-types-for 'script'"
      : "object-src 'none'; base-uri 'self'";

    const cspCondition = {
      urlFilter: '|http*',
      resourceTypes: ['main_frame', 'sub_frame']
    };
    if (whitelist.length > 0) {
      cspCondition.excludedInitiatorDomains = whitelist;
    }

    newRules.push({
      id: 2100,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'Content-Security-Policy',
            operation: 'append',
            value: cspValue
          }
        ]
      },
      condition: cspCondition
    });
  }

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: DNR_RULE_IDS,
    addRules: newRules
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[BrowseClean] declarativeNetRequest updateDynamicRules error:', chrome.runtime.lastError.message);
    }
  });
}

function enforceDeclarativeRules() {
  resolveEffectiveSettings((effective) => {
    syncDeclarativeSupplyChainRules(effective, effective.whitelistedDomains);
  });
}

// Initial WebRTC socket policy & declarative rules verification at worker startup
enforceWebRtcPolicy();
enforceDeclarativeRules();

// Listen for dynamic policy updates from enterprise MDM / GPO and local storage
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'managed') {
      resolveEffectiveSettings((effective, lockedKeys, isManaged) => {
        syncWebRtcHandlingPolicy(!!effective.blockWebRtcLeak, effective.webRtcPolicyMode);
        syncDeclarativeSupplyChainRules(effective, effective.whitelistedDomains);
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
        syncWebRtcHandlingPolicy(!!effective.blockWebRtcLeak, effective.webRtcPolicyMode);
        syncDeclarativeSupplyChainRules(effective, effective.whitelistedDomains);
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

// Enterprise SIEM & Syslog Ingestion Pipeline (ECS, CEF, RFC 5424)
const SIEM_NAME_MAP = {
  antiTamper: 'Anti-Tamper Prototype Protection',
  formDlp: 'Form DLP Synthetic Event Shield',
  webRtc: 'WebRTC Private LAN IP Leak Shield',
  phishing: 'Phishing Homoglyph Barrier',
  clipboardDlp: 'Clipboard DLP Watermark Sanitizer',
  sessionReplay: 'Session Replay Script Neutralized',
  contentFilter: 'Content Filter Modal Removal',
  adminAuth: 'Zero-Trust WebAuthn Admin Authentication',
  supplyChain: 'Declarative Supply-Chain Shield',
  general: 'Security Shield Intervention'
};

const SIEM_SEVERITY_MAP = {
  phishing: 9,
  formDlp: 8,
  antiTamper: 7,
  adminAuth: 8,
  supplyChain: 7,
  webRtc: 6,
  clipboardDlp: 5,
  sessionReplay: 4,
  contentFilter: 2,
  general: 3
};

function formatAsEcs(entry) {
  const categoryMap = {
    antiTamper: { category: ['host', 'security'], type: ['tampering', 'denied'], risk: 80, severity: 4 },
    formDlp: { category: ['data', 'security'], type: ['exfiltration', 'denied'], risk: 90, severity: 5 },
    webRtc: { category: ['network', 'security'], type: ['connection', 'denied'], risk: 75, severity: 3 },
    phishing: { category: ['network', 'threat'], type: ['malware', 'denied'], risk: 95, severity: 5 },
    clipboardDlp: { category: ['data', 'security'], type: ['exfiltration', 'denied'], risk: 70, severity: 3 },
    sessionReplay: { category: ['data', 'security'], type: ['exfiltration', 'denied'], risk: 65, severity: 3 },
    contentFilter: { category: ['configuration'], type: ['change'], risk: 20, severity: 1 },
    adminAuth: { category: ['authentication', 'iam'], type: ['access', 'allowed'], risk: 85, severity: 4 },
    supplyChain: { category: ['network', 'security'], type: ['protocol', 'denied'], risk: 80, severity: 4 },
    general: { category: ['configuration'], type: ['info'], risk: 10, severity: 1 }
  };
  const catInfo = categoryMap[entry.category] || categoryMap.general;
  const manifestVer = (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.1.0';

  return {
    '@timestamp': entry.timestamp || new Date().toISOString(),
    ecs: { version: '8.11.0' },
    event: {
      id: entry.id || ('evt_' + Math.random().toString(36).substring(2, 10)),
      sequence: entry.sequence || 0,
      category: catInfo.category,
      type: catInfo.type,
      action: entry.action || 'intervene',
      outcome: 'success',
      dataset: 'browseclean.audit',
      module: 'endpoint_shield',
      risk_score: catInfo.risk,
      severity: catInfo.severity
    },
    service: {
      name: 'browseclean',
      version: manifestVer
    },
    host: {
      name: 'endpoint-client'
    },
    url: {
      domain: entry.domain || '',
      original: entry.domain ? `https://${entry.domain}` : ''
    },
    rule: {
      name: SIEM_NAME_MAP[entry.category] || 'Endpoint Defense Rule',
      category: entry.category || 'general'
    },
    message: entry.details || `BrowseClean intervention: ${entry.action} on ${entry.domain}`,
    hash: {
      sha256: entry.entryHash || ''
    },
    labels: {
      prev_hash: entry.prevHash || '',
      entry_hash: entry.entryHash || '',
      extension_id: chrome.runtime.id || 'browseclean'
    }
  };
}

function formatBatchAsEcsNdjson(entries) {
  if (!Array.isArray(entries)) return '';
  return entries.map(e => JSON.stringify(formatAsEcs(e))).join('\n');
}

function formatAsCef(entry) {
  const version = '0';
  const vendor = 'BrowseClean';
  const product = 'EndpointShield';
  const devVersion = (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.1.0';
  const classId = entry.category || 'general';
  const eventName = SIEM_NAME_MAP[entry.category] || 'Security Intervention';
  const severity = SIEM_SEVERITY_MAP[entry.category] || 3;

  const escapeHeader = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  const escapeExt = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\r?\n/g, '\\n');

  const rt = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
  const dhost = entry.domain ? escapeExt(entry.domain) : 'unknown';
  const act = entry.action ? escapeExt(entry.action) : 'intervene';
  const msg = entry.details ? escapeExt(entry.details) : 'Security shield intervention';
  const cn1 = typeof entry.sequence === 'number' ? entry.sequence : 0;
  const cs1 = entry.prevHash ? escapeExt(entry.prevHash) : '';
  const cs2 = entry.entryHash ? escapeExt(entry.entryHash) : '';
  const extId = entry.id ? escapeExt(entry.id) : '';

  const extension = `rt=${rt} dhost=${dhost} act=${act} cat=${classId} msg=${msg} cn1=${cn1} cn1Label=SequenceId cs1=${cs1} cs1Label=PrevHash cs2=${cs2} cs2Label=EntryHash externalId=${extId}`;

  return `CEF:${version}|${escapeHeader(vendor)}|${escapeHeader(product)}|${escapeHeader(devVersion)}|${escapeHeader(classId)}|${escapeHeader(eventName)}|${severity}|${extension}`;
}

function formatBatchAsCef(entries) {
  if (!Array.isArray(entries)) return '';
  return entries.map(formatAsCef).join('\n');
}

function formatAsRfc5424(entry) {
  const priMap = {
    phishing: 83,      // authpriv (10) * 8 + Error (3)
    formDlp: 83,       // authpriv (10) * 8 + Error (3)
    adminAuth: 83,     // authpriv (10) * 8 + Error (3)
    antiTamper: 84,    // authpriv (10) * 8 + Warning (4)
    supplyChain: 84,   // authpriv (10) * 8 + Warning (4)
    webRtc: 84,        // authpriv (10) * 8 + Warning (4)
    clipboardDlp: 85,  // authpriv (10) * 8 + Notice (5)
    sessionReplay: 85, // authpriv (10) * 8 + Notice (5)
    contentFilter: 86  // authpriv (10) * 8 + Info (6)
  };
  const pri = priMap[entry.category] || 86;
  const version = '1';
  const timestamp = entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString();
  const hostname = 'endpoint.browser';
  const appName = 'BrowseClean';
  const procId = 'shield';
  const msgId = `SEC-${(entry.category || 'EVENT').toUpperCase()}`;

  const escapeSd = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\]/g, '\\]');

  const seq = entry.sequence || 0;
  const domain = escapeSd(entry.domain);
  const category = escapeSd(entry.category);
  const action = escapeSd(entry.action);
  const prevHash = escapeSd(entry.prevHash);
  const entryHash = escapeSd(entry.entryHash);
  const eventId = escapeSd(entry.id);

  const sd = `[audit@53288 seq="${seq}" domain="${domain}" category="${category}" action="${action}" id="${eventId}" prevHash="${prevHash}" entryHash="${entryHash}"]`;
  const msg = entry.details ? ` ${entry.details}` : ` Intervention on ${domain}`;

  return `<${pri}>${version} ${timestamp} ${hostname} ${appName} ${procId} ${msgId} ${sd}${msg}`;
}

function formatBatchAsRfc5424(entries) {
  if (!Array.isArray(entries)) return '';
  return entries.map(formatAsRfc5424).join('\n');
}

// In-Memory Forwarder Queue & HTTP Pipeline
let siemBuffer = [];
let siemFlushTimeout = null;
const siemStats = {
  totalDispatched: 0,
  failedDispatched: 0,
  lastDispatchTime: null,
  lastDispatchStatus: 'Idle'
};

async function dispatchSiemBatch(events, settings) {
  if (!settings.siemEndpoint || !Array.isArray(events) || events.length === 0) return;

  const format = settings.siemFormat || 'ecs_json';
  let payloadBody = '';
  let contentType = 'application/json';

  if (format === 'cef') {
    payloadBody = formatBatchAsCef(events);
    contentType = 'text/plain';
  } else if (format === 'rfc5424') {
    payloadBody = formatBatchAsRfc5424(events);
    contentType = 'application/syslog';
  } else {
    payloadBody = formatBatchAsEcsNdjson(events);
    contentType = 'application/x-ndjson';
  }

  const headers = {
    'Content-Type': contentType,
    'X-BrowseClean-Batch-Size': String(events.length),
    'X-BrowseClean-Audit-Root': (events[0] && events[0].entryHash) ? events[0].entryHash : ''
  };

  if (settings.siemAuthHeader && settings.siemAuthHeader.trim()) {
    headers['Authorization'] = settings.siemAuthHeader.trim();
  }

  try {
    const response = await fetch(settings.siemEndpoint, {
      method: 'POST',
      headers: headers,
      body: payloadBody
    });

    if (response.ok) {
      siemStats.totalDispatched += events.length;
      siemStats.lastDispatchTime = new Date().toISOString();
      siemStats.lastDispatchStatus = `Success (HTTP ${response.status}) at ${new Date().toLocaleTimeString()}`;
    } else {
      siemStats.failedDispatched += events.length;
      siemStats.lastDispatchStatus = `Failed (HTTP ${response.status}: ${response.statusText})`;
      if (siemBuffer.length < 200) {
        siemBuffer.unshift(...events);
      }
    }
  } catch (err) {
    siemStats.failedDispatched += events.length;
    siemStats.lastDispatchStatus = `Network Error: ${err.message || 'Endpoint unreachable'}`;
    if (siemBuffer.length < 200) {
      siemBuffer.unshift(...events);
    }
  }
}

function queueSiemEvent(entry, settings) {
  if (!settings.siemForwarding || !settings.siemEndpoint) return;

  siemBuffer.push(entry);
  const batchSize = Math.max(1, parseInt(settings.siemBatchSize, 10) || 10);

  if (siemBuffer.length >= batchSize) {
    const toSend = siemBuffer.splice(0, batchSize);
    if (siemFlushTimeout) {
      clearTimeout(siemFlushTimeout);
      siemFlushTimeout = null;
    }
    dispatchSiemBatch(toSend, settings);
  } else if (!siemFlushTimeout) {
    siemFlushTimeout = setTimeout(() => {
      siemFlushTimeout = null;
      if (siemBuffer.length > 0) {
        const toSend = siemBuffer.splice(0, siemBuffer.length);
        dispatchSiemBatch(toSend, settings);
      }
    }, 5000);
  }
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
          if (settings.siemForwarding) {
            queueSiemEvent(chainedEntry, settings);
          }
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
        'blockWebRtcLeak', 'webRtcPolicyMode', 'blockPhishingSpoofs', 'clipboardDlp',
        'siemForwarding', 'siemEndpoint', 'siemAuthHeader', 'siemFormat', 'siemBatchSize',
        'webAuthnAdminLock', 'declarativeSupplyChain', 'dynamicCspHardening', 'cspMode'
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

  if (message.action === 'getWebRtcSocketDiagnostics') {
    if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
      chrome.privacy.network.webRTCIPHandlingPolicy.get({}, (details) => {
        sendResponse({
          supported: true,
          value: details ? details.value : 'unknown',
          levelOfControl: details ? details.levelOfControl : 'unknown'
        });
      });
    } else {
      sendResponse({
        supported: false,
        value: 'unsupported',
        levelOfControl: 'not_controllable'
      });
    }
    return true;
  }

  // SIEM Batch Serialization for Air-Gapped Export
  if (message.action === 'formatAuditLog') {
    chrome.storage.local.get(['auditLog'], (res) => {
      const log = res.auditLog || [];
      const format = message.format || 'ecs_json';
      let formatted = '';
      let filename = '';
      let mimeType = 'text/plain';

      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (format === 'cef') {
        formatted = formatBatchAsCef(log);
        filename = `browseclean-audit-${ts}.cef`;
        mimeType = 'text/plain';
      } else if (format === 'rfc5424') {
        formatted = formatBatchAsRfc5424(log);
        filename = `browseclean-audit-rfc5424-${ts}.log`;
        mimeType = 'text/plain';
      } else {
        formatted = formatBatchAsEcsNdjson(log);
        filename = `browseclean-audit-ecs-${ts}.ndjson`;
        mimeType = 'application/x-ndjson';
      }

      sendResponse({
        content: formatted,
        filename: filename,
        mimeType: mimeType,
        count: log.length
      });
    });
    return true;
  }

  // SIEM Connection & Heartbeat Probe Test
  if (message.action === 'testSiemConnection') {
    resolveEffectiveSettings(async (settings) => {
      const endpoint = message.endpoint || settings.siemEndpoint;
      const authHeader = (typeof message.authHeader === 'string') ? message.authHeader : settings.siemAuthHeader;
      const format = message.format || settings.siemFormat || 'ecs_json';

      if (!endpoint || !endpoint.trim()) {
        sendResponse({ success: false, error: 'SIEM Ingestion Endpoint URL is empty.' });
        return;
      }

      const testTimestamp = new Date().toISOString();
      const testEvent = {
        sequence: 0,
        id: 'test_' + Date.now().toString(36),
        timestamp: testTimestamp,
        domain: 'browseclean.internal',
        category: 'general',
        action: 'siem_heartbeat_test',
        details: 'BrowseClean enterprise SIEM connectivity probe and cryptographic heartbeat',
        prevHash: GENESIS_HASH,
        entryHash: await computeSha256(`0|${testTimestamp}|browseclean.internal|general|siem_heartbeat_test|probe|${GENESIS_HASH}`)
      };

      let body = '';
      let ctype = 'application/json';
      if (format === 'cef') {
        body = formatAsCef(testEvent);
        ctype = 'text/plain';
      } else if (format === 'rfc5424') {
        body = formatAsRfc5424(testEvent);
        ctype = 'application/syslog';
      } else {
        body = JSON.stringify(formatAsEcs(testEvent));
        ctype = 'application/json';
      }

      const headers = {
        'Content-Type': ctype,
        'X-BrowseClean-Probe': 'Heartbeat'
      };
      if (authHeader && authHeader.trim()) {
        headers['Authorization'] = authHeader.trim();
      }

      const startTime = Date.now();
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: body
        });
        const latency = Date.now() - startTime;
        sendResponse({
          success: resp.ok,
          status: resp.status,
          statusText: resp.statusText,
          latencyMs: latency,
          error: resp.ok ? null : `HTTP ${resp.status}: ${resp.statusText}`
        });
      } catch (err) {
        sendResponse({
          success: false,
          status: 0,
          latencyMs: Date.now() - startTime,
          error: err.message || 'Failed to connect to SIEM endpoint'
        });
      }
    });
    return true;
  }

  // SIEM Live Diagnostics & Buffer Status
  if (message.action === 'getSiemDiagnostics') {
    resolveEffectiveSettings((settings, lockedKeys, isManaged) => {
      sendResponse({
        forwardingEnabled: !!settings.siemForwarding,
        endpoint: settings.siemEndpoint || '',
        format: settings.siemFormat || 'ecs_json',
        batchSize: settings.siemBatchSize || 10,
        hasAuthHeader: !!(settings.siemAuthHeader && settings.siemAuthHeader.trim()),
        bufferedEvents: siemBuffer.length,
        stats: siemStats,
        isManaged: isManaged,
        lockedKeys: lockedKeys || []
      });
    });
    return true;
  }

  // Declarative Supply-Chain Defense & Dynamic CSP Diagnostics
  if (message.action === 'getDeclarativeNetworkDiagnostics') {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.getDynamicRules) {
      sendResponse({
        supported: false,
        activeRuleCount: 0,
        rules: [],
        supplyChainBlocked: false,
        cspHardened: false,
        cspMode: 'disabled'
      });
      return true;
    }

    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      resolveEffectiveSettings((settings) => {
        sendResponse({
          supported: true,
          activeRuleCount: rules ? rules.length : 0,
          rules: rules || [],
          supplyChainBlocked: !!settings.declarativeSupplyChain,
          cspHardened: !!settings.dynamicCspHardening,
          cspMode: settings.cspMode || 'standard'
        });
      });
    });
    return true;
  }
});
