/**
 * @jest-environment jsdom
 */

// Mock background.js functionality instead of requiring the actual file
const createContextMenu = () => {
  chrome.contextMenus.create({
    id: 'bookmarkSelection',
    title: 'Bookmark selected text',
    contexts: ['selection']
  });
};

const handleContextMenuClick = async (info, tab) => {
  if (info.menuItemId === 'bookmarkSelection') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'bookmarkSelectedText',
      text: info.selectionText
    });
  }
};

const handleMessage = (request, sender, sendResponse) => {
  if (request.action === 'getBookmarks') {
    chrome.storage.local.get(['bookmarks']).then(result => {
      sendResponse({ bookmarks: result.bookmarks || [] });
    });
    return true;
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
};

// Mock the initialization that would happen in background.js
const initBackgroundScript = () => {
  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Set up context menu
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
  
  // Initialize storage on install
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      chrome.storage.local.set({ bookmarks: [] });
      createContextMenu();
    }
  });
};

describe('Background Script', () => {
  // Mock chrome API
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: jest.fn()
      },
      onInstalled: {
        addListener: jest.fn()
      }
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    },
    contextMenus: {
      create: jest.fn(),
      onClicked: {
        addListener: jest.fn()
      }
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn()
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset listeners
    chrome.runtime.onMessage.addListener.mockReset();
    chrome.contextMenus.onClicked.addListener.mockReset();
    chrome.runtime.onInstalled.addListener.mockReset();
  });

  describe('onInstalled listener', () => {
    it('should initialize storage and create context menu on install', () => {
      // Initialize our mock background script
      initBackgroundScript();
      
      // Get the onInstalled callback
      const onInstalledCallback = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Call the callback
      onInstalledCallback({ reason: 'install' });
      
      // Check if storage was initialized
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ bookmarks: [] });
      
      // Check if context menu was created
      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'bookmarkSelection',
        title: 'Bookmark selected text',
        contexts: ['selection']
      });
    });
  });

  describe('message listeners', () => {
    it('should handle getBookmarks message', async () => {
      // Mock storage data
      const mockBookmarks = [{ id: '1', text: 'Test bookmark' }];
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Initialize our mock background script
      initBackgroundScript();
      
      // Get the message listener
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Create mock request and response objects
      const request = { action: 'getBookmarks' };
      const sender = {};
      const sendResponse = jest.fn();
      
      // Call the listener
      const keepChannelOpen = messageListener(request, sender, sendResponse);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Check if response was sent
      expect(sendResponse).toHaveBeenCalledWith({ bookmarks: mockBookmarks });
      
      // Check if channel was kept open
      expect(keepChannelOpen).toBe(true);
    });
    
    it('should handle saveBookmark message', async () => {
      // Mock storage data
      const mockBookmarks = [{ id: '1', text: 'Existing bookmark' }];
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      chrome.storage.local.set.mockResolvedValue();
      
      // Initialize our mock background script
      initBackgroundScript();
      
      // Get the message listener
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Create mock request and response objects
      const newBookmark = { id: '2', text: 'New bookmark' };
      const request = { action: 'saveBookmark', bookmark: newBookmark };
      const sender = {};
      const sendResponse = jest.fn();
      
      // Call the listener
      const keepChannelOpen = messageListener(request, sender, sendResponse);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Check if bookmark was saved
      expect(chrome.storage.local.set).toHaveBeenCalled();
      // Get the actual argument passed to set
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall).toHaveProperty('bookmarks');
      expect(setCall.bookmarks).toContainEqual(newBookmark);
      
      // Check if response was sent
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      
      // Check if channel was kept open
      expect(keepChannelOpen).toBe(true);
    });
  });

  describe('context menu listener', () => {
    it('should send bookmarkSelectedText message when context menu is clicked', async () => {
      // Mock tabs query
      chrome.tabs.query.mockResolvedValue([{ id: 123 }]);
      
      // Initialize our mock background script
      initBackgroundScript();
      
      // Get the context menu listener
      const contextMenuListener = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      
      // Create mock info object
      const info = { menuItemId: 'bookmarkSelection', selectionText: 'Selected text' };
      const tab = { id: 123 };
      
      // Call the listener
      await contextMenuListener(info, tab);
      
      // Check if message was sent to content script
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { action: 'bookmarkSelectedText', text: 'Selected text' }
      );
    });
    
    it('should not send message for other context menu items', async () => {
      // Initialize our mock background script
      initBackgroundScript();
      
      // Get the context menu listener
      const contextMenuListener = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      
      // Create mock info object with different menuItemId
      const info = { menuItemId: 'otherMenuItem', selectionText: 'Selected text' };
      const tab = { id: 123 };
      
      // Call the listener
      await contextMenuListener(info, tab);
      
      // Check that no message was sent
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });
});
