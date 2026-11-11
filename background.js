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

// Telemetry & Badge Synchronization
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
