// Handle messages from popup and content scripts
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
      messages.splice(request.index, 1);
      
      chrome.storage.sync.set({ pinnedMessages: messages }, () => {
        sendResponse({ success: true, messages: messages });
      });
    });
    return true;
  }
  
  if (request.action === "openPopup") {
    // This will open the popup UI
    chrome.action.openPopup();
    return true;
  }

  return false; // Return false if no action is handled
});

// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  
  // Initialize storage with default values
  chrome.storage.sync.get(['enabled', 'pinnedMessages', 'maxPins'], (data) => {
    const updates = {};
    
    if (data.enabled === undefined) {
      updates.enabled = true;
    }
    
    if (!data.pinnedMessages) {
      updates.pinnedMessages = [];
    }
    
    if (data.maxPins === undefined) {
      updates.maxPins = 50; // Default: 50 pins
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates, () => {
        console.log("Storage initialized with defaults:", updates);
      });
    }
  });
});

// Clean up old pins when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.pinnedMessages) {
    cleanupPins();
  }
});

// Function to clean up pins based on maxPins
function cleanupPins() {
  chrome.storage.sync.get(['pinnedMessages', 'maxPins'], (data) => {
    const messages = data.pinnedMessages || [];
    if (messages.length === 0) return;
    
    const maxPins = data.maxPins || 50;
    
    // Sort by timestamp (newest first)
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply max pins limit
    const finalMessages = messages.slice(0, maxPins);
    
    // Only update if we removed any messages
    if (finalMessages.length < messages.length) {
      chrome.storage.sync.set({ pinnedMessages: finalMessages }, () => {
        console.log(`Applied max pins limit. Removed ${messages.length - finalMessages.length} old pins.`);
      });
    }
  });
}
