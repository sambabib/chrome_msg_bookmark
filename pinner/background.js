// Background script for the Chat Bookmarks extension
// Handles extension lifecycle and cross-tab communication

chrome.runtime.onInstalled.addListener(() => {
  console.log('Chat Bookmarks extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBookmarks') {
    chrome.storage.local.get(['bookmarks']).then(result => {
      sendResponse({ bookmarks: result.bookmarks || [] });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'saveBookmark') {
    chrome.storage.local.get(['bookmarks']).then(result => {
      const bookmarks = result.bookmarks || [];
      bookmarks.push(request.bookmark);
      chrome.storage.local.set({ bookmarks }).then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

// Optional: Add context menu for bookmarking
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'bookmark-selection') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'bookmarkSelection',
      text: info.selectionText
    });
  }
});

// Create context menu when extension starts
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function createContextMenu() {
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
}