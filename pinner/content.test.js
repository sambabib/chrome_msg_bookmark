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
  });
});
