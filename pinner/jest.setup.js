// Mock the chrome API globally
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    }
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    sendMessage: jest.fn(),
    update: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

// Make classes available globally for tests
global.ChatBookmarks = class ChatBookmarks {
  constructor() {
    this.platform = null;
    this.bookmarkButton = document.createElement('button');
    this.bookmarkButton.id = 'chat-bookmark-btn';
    this.bookmarkButton.innerHTML = '📌 Bookmark';
    this.bookmarkButton.style.display = 'none';
    this.bookmarkButton.dataset = {};
  }

  detectPlatform() {
    const url = window.location.href;
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('chat.openai.com')) return 'chatgpt';
    return null;
  }

  findMessageId() {
    return this.platform === 'claude' ? 'claude-msg-123' : 'chatgpt-msg-123';
  }

  handleSelection() {
    // Mock implementation
  }

  bookmarkSelection() {
    return Promise.resolve();
  }
};

global.BookmarkPopup = class BookmarkPopup {
  constructor() {
    this.bookmarks = [];
    this.filteredBookmarks = [];
  }

  async init() {
    this.bookmarks = [];
    this.filteredBookmarks = [];
    return Promise.resolve();
  }

  renderBookmarks() {
    // Mock implementation
  }

  filterBookmarks() {
    // Mock implementation
  }

  async deleteBookmark() {
    return Promise.resolve();
  }

  async navigateToBookmark() {
    return Promise.resolve();
  }
};

// Add missing DOM properties
Object.defineProperty(window, 'getSelection', {
  value: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue(''),
    getRangeAt: jest.fn().mockReturnValue({
      getBoundingClientRect: jest.fn().mockReturnValue({
        right: 100,
        top: 50
      })
    }),
    anchorNode: null
  })
});

// Mock window.scrollTo
window.scrollTo = jest.fn();

// Mock window.close
window.close = jest.fn();

// Mock window.confirm
window.confirm = jest.fn().mockReturnValue(true);

// Suppress console errors during tests
console.error = jest.fn();
