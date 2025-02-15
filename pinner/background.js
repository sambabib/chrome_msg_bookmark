chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    return true; // Indicate asynchronous response
  }

  return false; // Return false if no action is handled
});
