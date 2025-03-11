// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);
  
  if (request.action === "getPinnedMessages") {
    chrome.storage.sync.get("pinnedMessages", (data) => {
      sendResponse({ pinnedMessages: data.pinnedMessages || [] });
    });
    return true; // Indicate asynchronous response
  }

  if (request.action === "clearPinnedMessages") {
    chrome.storage.sync.remove("pinnedMessages", () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === "deletePinnedMessage") {
    chrome.storage.sync.get("pinnedMessages", (data) => {
      const messages = data.pinnedMessages || [];
      const newMessages = messages.filter((msg, index) => index !== request.index);
      
      chrome.storage.sync.set({ pinnedMessages: newMessages }, () => {
        sendResponse({ success: true, messages: newMessages });
      });
    });
    return true;
  }

  return false; // Return false if no action is handled
});

// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['pinnedMessages'], (data) => {
    if (!data.pinnedMessages) {
      chrome.storage.sync.set({ pinnedMessages: [] });
    }
  });
});
