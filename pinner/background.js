chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPinnedMessages") {
    chrome.storage.sync.get("pinnedMessages", (data) => {
      sendResponse({ pinnedMessages: data.pinnedMessages || [] });
    });
    return true;
  }

  if (request.action === "clearPinnedMessages") {
    chrome.storage.sync.remove("pinnedMessages", () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
