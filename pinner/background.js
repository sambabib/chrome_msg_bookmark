// Background script for the Chat Bookmarks extension
// Handles extension lifecycle and cross-tab communication

// Initialize storage on installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Chat Bookmarks extension installed');
  
  // Initialize storage if needed
  const result = await chrome.storage.local.get(['bookmarks']);
  if (!result.bookmarks) {
    await chrome.storage.local.set({ bookmarks: [] });
  }
  
  // Create context menu
  createContextMenu();
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBookmarks') {
    chrome.storage.local.get(['bookmarks'])
      .then(result => {
        sendResponse({ bookmarks: result.bookmarks || [] });
      })
      .catch(error => {
        console.error('Error getting bookmarks:', error);
        sendResponse({ bookmarks: [], error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'saveBookmark') {
    chrome.storage.local.get(['bookmarks'])
      .then(result => {
        const bookmarks = result.bookmarks || [];
        bookmarks.push(request.bookmark);
        return chrome.storage.local.set({ bookmarks });
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error saving bookmark:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Create context menu item for bookmarking
function createContextMenu() {
  // Remove existing items first to avoid duplicates
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: 'bookmark-selection',
      title: 'Bookmark this text',
      contexts: ['selection'],
      documentUrlPatterns: [
        'https://claude.ai/*',
        'https://chat.openai.com/*',
        'https://chatgpt.com/*'
      ]
    });
  }).catch(error => {
    console.error('Error creating context menu:', error);
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'bookmark-selection') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'bookmarkSelection',
      text: info.selectionText
    }).catch(error => {
      console.error('Error sending message to tab:', error);
    });
  }
});

// Service workers don't need onStartup since they're event-based
// and will be initialized when needed