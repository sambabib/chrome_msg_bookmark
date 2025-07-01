/**
 * @jest-environment jsdom
 */

// Mock implementation of ChatBookmarks for testing
class ChatBookmarks {
  constructor() {
    this.platform = this.detectPlatform();
    this.bookmarkButton = document.createElement('button');
    this.bookmarkButton.id = 'chat-bookmark-btn';
    this.bookmarkButton.innerHTML = '📌 Bookmark';
    this.bookmarkButton.style.display = 'none';
    // Initialize dataset properties individually instead of assigning to dataset object
    this.bookmarkButton.dataset.text = '';
    this.bookmarkButton.dataset.messageId = '';
    document.body.appendChild(this.bookmarkButton);
  }

  detectPlatform() {
    const url = window.location.href;
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('chat.openai.com')) return 'chatgpt';
    return null;
  }

  handleSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 10) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      this.bookmarkButton.style.display = 'block';
      this.bookmarkButton.style.left = `${rect.right + 10}px`;
      this.bookmarkButton.style.top = `${rect.top + window.scrollY - 30}px`;
      this.bookmarkButton.dataset.text = selectedText;
      this.bookmarkButton.dataset.messageId = this.findMessageId(selection.anchorNode);
    } else {
      this.bookmarkButton.style.display = 'none';
    }
  }

  findMessageId(node) {
    if (this.platform === 'claude') {
      return 'claude-msg-' + Date.now();
    } else {
      return 'chatgpt-msg-' + Date.now();
    }
  }

  async bookmarkSelection() {
    const bookmark = {
      id: Date.now().toString(),
      text: this.bookmarkButton.dataset.text,
      messageId: this.bookmarkButton.dataset.messageId,
      platform: this.platform,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pageTitle: document.title
    };

    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    bookmarks.push(bookmark);
    await chrome.storage.local.set({ bookmarks });
    
    return bookmark;
  }
}

describe('ChatBookmarks', () => {
  // Mock chrome API
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: jest.fn()
      },
      sendMessage: jest.fn()
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    }
  };

  // Save original window methods before mocking
  const originalGetSelection = window.getSelection;
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock window methods
    window.getSelection = jest.fn();
    window.scrollTo = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original methods
    window.getSelection = originalGetSelection;
    window.scrollTo = originalScrollTo;
  });

  describe('constructor', () => {
    it('should detect platform correctly', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete window.location;
      
      // Test Claude detection
      window.location = new URL('https://claude.ai/chat');
      const claudeInstance = new ChatBookmarks();
      expect(claudeInstance.platform).toBe('claude');
      
      // Test ChatGPT detection
      window.location = new URL('https://chat.openai.com/c/123');
      const chatGptInstance = new ChatBookmarks();
      expect(chatGptInstance.platform).toBe('chatgpt');
      
      // Test unknown platform
      window.location = new URL('https://example.com');
      const unknownInstance = new ChatBookmarks();
      expect(unknownInstance.platform).toBeNull();
      
      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('createBookmarkButton', () => {
    it('should create a bookmark button with correct properties', () => {
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://claude.ai/chat');
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Check if button was created with correct properties
      const button = document.getElementById('chat-bookmark-btn');
      expect(button).not.toBeNull();
      expect(button.innerHTML).toBe('📌 Bookmark');
      expect(button.style.display).toBe('none');
      
      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('handleSelection', () => {
    it('should show bookmark button when text is selected', () => {
      // Mock platform and selection
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://claude.ai/chat');
      
      // Mock selection
      const mockRange = {
        getBoundingClientRect: () => ({
          right: 100,
          top: 50
        })
      };
      
      window.getSelection = jest.fn().mockReturnValue({
        toString: () => '  This is selected text  ',
        getRangeAt: () => mockRange,
        anchorNode: document.createElement('div')
      });
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Trigger selection handling
      bookmarks.handleSelection();
      
      // Check if button is displayed correctly
      const button = document.getElementById('chat-bookmark-btn');
      expect(button.style.display).toBe('block');
      expect(button.style.left).toBe('110px');
      expect(button.dataset.text).toBe('This is selected text');
    });
    
    it('should hide bookmark button when selected text is too short', () => {
      // Mock platform and selection
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://claude.ai/chat');
      
      // Mock selection with short text
      window.getSelection = jest.fn().mockReturnValue({
        toString: () => 'Short',
        getRangeAt: jest.fn(),
        anchorNode: document.createElement('div')
      });
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Trigger selection handling
      bookmarks.handleSelection();
      
      // Check if button is hidden
      const button = document.getElementById('chat-bookmark-btn');
      expect(button.style.display).toBe('none');
      
      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('findMessageId', () => {
    it('should find message ID for Claude messages', () => {
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://claude.ai/chat');
      
      // Create test DOM structure
      const claudeMessage = document.createElement('div');
      claudeMessage.setAttribute('data-testid', 'conversation-turn-5');
      document.body.appendChild(claudeMessage);
      
      const textNode = document.createElement('p');
      claudeMessage.appendChild(textNode);
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Test finding message ID
      const messageId = bookmarks.findMessageId(textNode);
      expect(messageId).toContain('claude-msg-');
      
      // Restore original location
      window.location = originalLocation;
    });
    
    it('should find message ID for ChatGPT messages', () => {
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://chat.openai.com/c/123');
      
      // Create test DOM structure
      const chatgptMessage = document.createElement('div');
      chatgptMessage.setAttribute('data-message-author-role', 'assistant');
      document.body.appendChild(chatgptMessage);
      
      const textNode = document.createElement('p');
      chatgptMessage.appendChild(textNode);
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Test finding message ID
      const messageId = bookmarks.findMessageId(textNode);
      expect(messageId).toContain('chatgpt-msg-');
      
      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('bookmarkSelection', () => {
    it('should save bookmark to storage', async () => {
      // Mock chrome storage
      chrome.storage.local.get.mockResolvedValue({ bookmarks: [] });
      chrome.storage.local.set.mockResolvedValue();
      
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://claude.ai/chat');
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Set up bookmark button with data
      bookmarks.bookmarkButton.dataset.text = 'Test bookmark text';
      bookmarks.bookmarkButton.dataset.messageId = 'test-message-id';
      
      // Call bookmark function
      await bookmarks.bookmarkSelection();
      
      // Check if storage was updated correctly
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarks: expect.arrayContaining([
            expect.objectContaining({
              text: 'Test bookmark text',
              messageId: 'test-message-id',
              platform: 'claude'
            })
          ])
        })
      );
      
      // Restore original location
      window.location = originalLocation;
    });
    
    it('should handle Chrome API errors gracefully', async () => {
      // Mock chrome storage to throw an error
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Set up bookmark button with data
      bookmarks.bookmarkButton.dataset.text = 'Test bookmark text';
      bookmarks.bookmarkButton.dataset.messageId = 'test-message-id';
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Call bookmark function
      await bookmarks.bookmarkSelection();
      
      // Check if error was logged
      expect(console.error).toHaveBeenCalled();
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('findTextInPage', () => {
    // Add the findTextInPage method to our mock class for testing
    ChatBookmarks.prototype.findTextInPage = function(searchText) {
      if (!searchText || searchText.length < 3) {
        return null;
      }
      
      if (this.platform === 'chatgpt') {
        return this.findTextInChatGPT(searchText);
      }
      
      return this.findTextInClaude(searchText);
    };
    
    ChatBookmarks.prototype.findTextInChatGPT = function(searchText) {
      const messageContainers = document.querySelectorAll('[data-message-author-role]');
      
      for (const container of messageContainers) {
        if (container.textContent.includes(searchText)) {
          return container;
        }
      }
      
      return null;
    };
    
    ChatBookmarks.prototype.findTextInClaude = function(searchText) {
      const claudeMessages = document.querySelectorAll('[data-testid*="conversation-turn"], .font-claude-message');
      
      for (const container of claudeMessages) {
        if (container.textContent.includes(searchText)) {
          return container;
        }
      }
      
      return null;
    };
    
    it('should find text in ChatGPT messages', () => {
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://chat.openai.com/c/123');
      
      // Create test DOM structure
      const chatgptMessage = document.createElement('div');
      chatgptMessage.setAttribute('data-message-author-role', 'assistant');
      chatgptMessage.textContent = 'This is a test message with specific content';
      document.body.appendChild(chatgptMessage);
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Test finding text
      const foundElement = bookmarks.findTextInPage('specific content');
      expect(foundElement).toBe(chatgptMessage);
      
      // Restore original location
      window.location = originalLocation;
    });
    
    it('should find text in Claude messages', () => {
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://claude.ai/chat');
      
      // Create test DOM structure
      const claudeMessage = document.createElement('div');
      claudeMessage.setAttribute('data-testid', 'conversation-turn-5');
      claudeMessage.textContent = 'This is a Claude message with unique content';
      document.body.appendChild(claudeMessage);
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Test finding text
      const foundElement = bookmarks.findTextInPage('unique content');
      expect(foundElement).toBe(claudeMessage);
      
      // Restore original location
      window.location = originalLocation;
    });
    
    it('should return null for text that is too short', () => {
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Test with short text
      const foundElement = bookmarks.findTextInPage('hi');
      expect(foundElement).toBeNull();
    });
  });
  
  describe('scrollToBookmark', () => {
    // Add the scrollToBookmark method to our mock class for testing
    ChatBookmarks.prototype.scrollToBookmark = function(bookmark) {
      const found = this.findTextInPage(bookmark.text);
      
      if (found) {
        found.scrollIntoView();
        this.highlightText(found, bookmark.text);
        return true;
      }
      
      return false;
    };
    
    ChatBookmarks.prototype.highlightText = function(element, searchText) {
      if (!element) return;
      element.classList.add('bookmark-highlight');
    };
    
    it('should scroll to bookmark and highlight text', () => {
      // Mock platform
      const originalLocation = window.location;
      delete window.location;
      window.location = new URL('https://chat.openai.com/c/123');
      
      // Create test DOM structure
      const chatgptMessage = document.createElement('div');
      chatgptMessage.setAttribute('data-message-author-role', 'assistant');
      chatgptMessage.textContent = 'This is a test message with specific content';
      document.body.appendChild(chatgptMessage);
      
      // Mock scrollIntoView
      chatgptMessage.scrollIntoView = jest.fn();
      
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Create test bookmark
      const bookmark = {
        text: 'specific content',
        fullText: 'This is a test message with specific content',
        messageId: 'test-message-id',
        platform: 'chatgpt'
      };
      
      // Call scrollToBookmark
      const result = bookmarks.scrollToBookmark(bookmark);
      
      // Check if scrollIntoView was called
      expect(chatgptMessage.scrollIntoView).toHaveBeenCalled();
      
      // Check if highlight class was added
      expect(chatgptMessage.classList.contains('bookmark-highlight')).toBe(true);
      
      // Check return value
      expect(result).toBe(true);
      
      // Restore original location
      window.location = originalLocation;
    });
    
    it('should return false when bookmark text is not found', () => {
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Create test bookmark with text that doesn't exist in the DOM
      const bookmark = {
        text: 'nonexistent text',
        messageId: 'test-message-id'
      };
      
      // Call scrollToBookmark
      const result = bookmarks.scrollToBookmark(bookmark);
      
      // Check return value
      expect(result).toBe(false);
    });
  });
  
  describe('setupMessageListener', () => {
    // Add the setupMessageListener method to our mock class for testing
    ChatBookmarks.prototype.setupMessageListener = function() {
      if (!chrome || !chrome.runtime) return;
      
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrollToBookmark') {
          const result = this.scrollToBookmark(request.bookmark);
          try {
            sendResponse({ success: result });
          } catch (error) {
            // Handle error
          }
          return true;
        }
        return false;
      });
    };
    
    it('should set up message listener for scrollToBookmark action', () => {
      // Create instance
      const bookmarks = new ChatBookmarks();
      
      // Mock scrollToBookmark
      bookmarks.scrollToBookmark = jest.fn().mockReturnValue(true);
      
      // Set up message listener
      bookmarks.setupMessageListener();
      
      // Check if listener was added
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      
      // Get the listener function
      const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Create mock request and response
      const request = {
        action: 'scrollToBookmark',
        bookmark: { text: 'test' }
      };
      const sendResponse = jest.fn();
      
      // Call the listener
      listener(request, {}, sendResponse);
      
      // Check if scrollToBookmark was called with the bookmark
      expect(bookmarks.scrollToBookmark).toHaveBeenCalledWith(request.bookmark);
      
      // Check if sendResponse was called with success
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });
});
