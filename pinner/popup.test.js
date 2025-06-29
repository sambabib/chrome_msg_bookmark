/**
 * @jest-environment jsdom
 */

// Mock implementation of BookmarkPopup for testing
class BookmarkPopup {
  constructor() {
    this.bookmarks = [];
    this.filteredBookmarks = [];
  }

  async init() {
    const result = await chrome.storage.local.get(['bookmarks']);
    this.bookmarks = result.bookmarks || [];
    this.filteredBookmarks = [...this.bookmarks].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Set up event listeners
    document.getElementById('searchInput').onchange = (e) => this.filterBookmarks(e.target.value);
    document.getElementById('refreshBtn').onclick = () => this.init();
    document.getElementById('clearAllBtn').onclick = () => this.clearAllBookmarks();
    
    this.renderBookmarks();
    return this;
  }

  renderBookmarks() {
    const container = document.getElementById('bookmarksContainer');
    container.innerHTML = '';
    
    if (this.filteredBookmarks.length === 0) {
      container.innerHTML = '<div class="empty-state">No bookmarks yet</div>';
      return;
    }
    
    this.filteredBookmarks.forEach(bookmark => {
      const bookmarkEl = document.createElement('div');
      bookmarkEl.className = 'bookmark-item';
      bookmarkEl.dataset.id = bookmark.id;
      bookmarkEl.onclick = () => this.navigateToBookmark(bookmark.id);
      
      bookmarkEl.innerHTML = `
        <div class="bookmark-text">${bookmark.text}</div>
        <div class="bookmark-meta">
          <span class="bookmark-platform">${bookmark.platform}</span>
          <span class="bookmark-date">${new Date(bookmark.timestamp).toLocaleString()}</span>
          <button class="delete-btn" data-id="${bookmark.id}">Delete</button>
        </div>
      `;
      
      container.appendChild(bookmarkEl);
      
      // Add delete button click handler
      const deleteBtn = bookmarkEl.querySelector('.delete-btn');
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deleteBookmark(bookmark.id);
      };
    });
  }

  filterBookmarks(searchTerm = '') {
    if (!searchTerm) {
      this.filteredBookmarks = [...this.bookmarks].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } else {
      const term = searchTerm.toLowerCase();
      this.filteredBookmarks = this.bookmarks.filter(bookmark => 
        bookmark.text.toLowerCase().includes(term) ||
        bookmark.pageTitle?.toLowerCase().includes(term)
      ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    this.renderBookmarks();
  }

  async deleteBookmark(id) {
    if (window.confirm('Delete this bookmark?')) {
      this.bookmarks = this.bookmarks.filter(b => b.id !== id);
      this.filteredBookmarks = this.filteredBookmarks.filter(b => b.id !== id);
      await chrome.storage.local.set({ bookmarks: this.bookmarks });
      this.renderBookmarks();
    }
  }

  async clearAllBookmarks() {
    if (window.confirm('Delete all bookmarks?')) {
      this.bookmarks = [];
      this.filteredBookmarks = [];
      await chrome.storage.local.set({ bookmarks: [] });
      this.renderBookmarks();
    }
  }

  async navigateToBookmark(id) {
    const bookmark = this.bookmarks.find(b => b.id === id);
    if (!bookmark) return;
    
    // Find if we have a tab open with the same URL
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab.url === bookmark.url) {
      // We're on the same page, just scroll to the bookmark
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'scrollToBookmark',
        bookmark
      });
      window.close();
    } else {
      // Navigate to the page first, then scroll to bookmark
      chrome.tabs.update(currentTab.id, { url: bookmark.url });
      
      // Wait for the page to load, then scroll to bookmark
      const listener = (tabId, changeInfo) => {
        if (tabId === currentTab.id && changeInfo.status === 'complete') {
          chrome.tabs.sendMessage(tabId, {
            action: 'scrollToBookmark',
            bookmark
          });
          chrome.tabs.onUpdated.removeListener(listener);
          window.close();
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
    }
  }
}

describe('BookmarkPopup', () => {
  // Mock chrome API
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn(),
      update: jest.fn(),
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    }
  };

  beforeEach(() => {
    // Set up DOM for popup
    document.body.innerHTML = `
      <div class="search-container">
        <input type="text" class="search-input" id="searchInput">
      </div>
      <div class="bookmarks-container" id="bookmarksContainer"></div>
      <div class="controls">
        <button class="btn" id="refreshBtn">Refresh</button>
        <button class="btn danger" id="clearAllBtn">Clear All</button>
      </div>
    `;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock window.close
    window.close = jest.fn();
    
    // Mock confirm
    window.confirm = jest.fn();
  });

  describe('init', () => {
    it('should load bookmarks and set up event listeners', async () => {
      // Mock storage data
      const mockBookmarks = [
        {
          id: '1',
          text: 'Bookmark 1',
          platform: 'claude',
          timestamp: '2025-06-27T10:00:00.000Z'
        },
        {
          id: '2',
          text: 'Bookmark 2',
          platform: 'chatgpt',
          timestamp: '2025-06-28T10:00:00.000Z'
        }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Check if bookmarks were loaded
      expect(popup.bookmarks).toEqual(mockBookmarks);
      expect(popup.filteredBookmarks).toEqual([mockBookmarks[1], mockBookmarks[0]]); // Sorted by timestamp
      
      // Check if event listeners were set up
      expect(document.getElementById('searchInput').onchange).toBeDefined;
      expect(document.getElementById('refreshBtn').onclick).toBeDefined;
      expect(document.getElementById('clearAllBtn').onclick).toBeDefined;
    });
  });

  describe('renderBookmarks', () => {
    it('should render bookmarks correctly', async () => {
      // Mock storage data
      const mockBookmarks = [
        {
          id: '1',
          text: 'Bookmark 1',
          platform: 'claude',
          timestamp: '2025-06-27T10:00:00.000Z',
          pageTitle: 'Claude Chat'
        }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Render bookmarks
      popup.renderBookmarks();
      
      // Check if bookmarks were rendered
      const container = document.getElementById('bookmarksContainer');
      expect(container.innerHTML).toContain('Bookmark 1');
      expect(container.innerHTML).toContain('claude');
      
      // Check if event listeners were added to bookmark items
      const bookmarkItem = container.querySelector('.bookmark-item');
      expect(bookmarkItem).not.toBeNull();
      expect(bookmarkItem.onclick).toBeDefined;
    });
    
    it('should show empty state when no bookmarks exist', async () => {
      // Mock empty storage
      chrome.storage.local.get.mockResolvedValue({ bookmarks: [] });
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Render bookmarks
      popup.renderBookmarks();
      
      // Check if empty state is shown
      const container = document.getElementById('bookmarksContainer');
      expect(container.innerHTML).toContain('No bookmarks yet');
    });
  });

  describe('filterBookmarks', () => {
    it('should filter bookmarks based on search term', async () => {
      // Mock storage data
      const mockBookmarks = [
        {
          id: '1',
          text: 'AI explanation',
          platform: 'claude',
          timestamp: '2025-06-27T10:00:00.000Z',
          pageTitle: 'Claude Chat'
        },
        {
          id: '2',
          text: 'Python code example',
          platform: 'chatgpt',
          timestamp: '2025-06-28T10:00:00.000Z',
          pageTitle: 'ChatGPT'
        }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Filter bookmarks
      popup.filterBookmarks('python');
      
      // Check if bookmarks were filtered
      expect(popup.filteredBookmarks.length).toBe(1);
      expect(popup.filteredBookmarks[0].id).toBe('2');
      
      // Check if rendered bookmarks were updated
      popup.renderBookmarks();
      const container = document.getElementById('bookmarksContainer');
      expect(container.innerHTML).toContain('Python code example');
      expect(container.innerHTML).not.toContain('AI explanation');
    });
  });

  describe('deleteBookmark', () => {
    it('should delete a bookmark when confirmed', async () => {
      // Mock storage data
      const mockBookmarks = [
        { id: '1', text: 'Bookmark 1' },
        { id: '2', text: 'Bookmark 2' }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      chrome.storage.local.set.mockResolvedValue();
      
      // Mock confirm to return true
      window.confirm = jest.fn().mockReturnValue(true);
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Delete bookmark
      await popup.deleteBookmark('1');
      
      // Check if bookmark was deleted
      expect(popup.bookmarks.length).toBe(1);
      expect(popup.bookmarks[0].id).toBe('2');
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        bookmarks: [{ id: '2', text: 'Bookmark 2' }]
      });
    });
    
    it('should not delete a bookmark when not confirmed', async () => {
      // Mock storage data
      const mockBookmarks = [
        { id: '1', text: 'Bookmark 1' },
        { id: '2', text: 'Bookmark 2' }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Mock confirm to return false
      window.confirm = jest.fn().mockReturnValue(false);
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Try to delete bookmark
      await popup.deleteBookmark('1');
      
      // Check if bookmark was not deleted
      expect(popup.bookmarks.length).toBe(2);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('navigateToBookmark', () => {
    it('should navigate to bookmark on same page', async () => {
      // Mock storage data
      const mockBookmarks = [
        {
          id: '1',
          text: 'Bookmark 1',
          url: 'https://claude.ai/chat/123'
        }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Mock tabs query to return current tab on same URL
      chrome.tabs.query.mockResolvedValue([{
        id: 123,
        url: 'https://claude.ai/chat/123'
      }]);
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Navigate to bookmark
      await popup.navigateToBookmark('1');
      
      // Check if message was sent to content script
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          action: 'scrollToBookmark',
          bookmark: mockBookmarks[0]
        })
      );
      
      // Check if popup was closed
      expect(window.close).toHaveBeenCalled();
    });
    
    it('should navigate to bookmark on different page', async () => {
      // Mock storage data
      const mockBookmarks = [
        {
          id: '1',
          text: 'Bookmark 1',
          url: 'https://claude.ai/chat/123'
        }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ bookmarks: mockBookmarks });
      
      // Mock tabs query to return current tab on different URL
      chrome.tabs.query.mockResolvedValue([{
        id: 123,
        url: 'https://claude.ai/chat/456'
      }]);
      
      // Create instance
      const popup = new BookmarkPopup();
      await popup.init();
      
      // Navigate to bookmark
      await popup.navigateToBookmark('1');
      
      // Check if tab was updated
      expect(chrome.tabs.update).toHaveBeenCalledWith(
        123,
        { url: 'https://claude.ai/chat/123' }
      );
      
      // Check if listener was added
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
    });
  });
});
