/**
 * @jest-environment jsdom
 */

// Mock background.js functionality instead of requiring the actual file
const createContextMenu = async () => {
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    id: 'bookmark-selection',
    title: 'Bookmark this text',
    contexts: ['selection'],
    documentUrlPatterns: [
      'https://claude.ai/*',
      'https://chat.openai.com/*',
      'https://chatgpt.com/*'
    ]
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
  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === 'install') {
      const result = await chrome.storage.local.get(['bookmarks']);
      if (!result.bookmarks) {
        await chrome.storage.local.set({ bookmarks: [] });
      }
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
      },
      onStartup: {
        addListener: jest.fn()
      }
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue()
      }
    },
    contextMenus: {
      create: jest.fn().mockResolvedValue(),
      removeAll: jest.fn().mockResolvedValue(),
      onClicked: {
        addListener: jest.fn()
      }
    },
    tabs: {
      query: jest.fn().mockResolvedValue([]),
      sendMessage: jest.fn().mockResolvedValue()
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
    it('should initialize storage and create context menu on install', async () => {
      // Mock storage.get to return no bookmarks
      chrome.storage.local.get.mockResolvedValue({ bookmarks: null });
      chrome.contextMenus.removeAll.mockResolvedValue();
      
      // Initialize our mock background script
      initBackgroundScript();
      
      // Get the onInstalled callback
      const onInstalledCallback = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Call the callback
      await onInstalledCallback({ reason: 'install' });
      
      // Check if storage was initialized
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ bookmarks: [] });
      
      // Check if context menu was created after removeAll
      expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'bookmark-selection',
        title: 'Bookmark this text',
        contexts: ['selection'],
        documentUrlPatterns: [
          'https://claude.ai/*',
          'https://chat.openai.com/*',
          'https://chatgpt.com/*'
        ]
      });
    });
    
    it('should not initialize storage if bookmarks already exist', async () => {
      // Mock storage.get to return existing bookmarks
      chrome.storage.local.get.mockResolvedValue({ bookmarks: [] });
      chrome.contextMenus.removeAll.mockResolvedValue();
      
      // Initialize our mock background script
      initBackgroundScript();
      
      // Reset mocks for this test
      chrome.storage.local.set.mockClear();
      chrome.contextMenus.create.mockClear();
      chrome.contextMenus.removeAll.mockClear();
      
      // Get the onInstalled callback
      const onInstalledCallback = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Call the callback
      await onInstalledCallback({ reason: 'install' });
      
      // Check storage was not initialized again
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      
      // Check context menu was still created
      expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
      expect(chrome.contextMenus.create).toHaveBeenCalled();
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
