class BookmarkPopup {
    constructor() {
      this.bookmarks = [];
      this.filteredBookmarks = [];
      this.init();
    }
  
    async init() {
      await this.loadBookmarks();
      this.setupEventListeners();
      this.renderBookmarks();
    }
  
    async loadBookmarks() {
      const result = await chrome.storage.local.get(['bookmarks']);
      this.bookmarks = result.bookmarks || [];
      this.filteredBookmarks = [...this.bookmarks];
      
      // Sort by timestamp (newest first)
      this.filteredBookmarks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  
    setupEventListeners() {
      // Search functionality
      document.getElementById('searchInput').addEventListener('input', (e) => {
        this.filterBookmarks(e.target.value);
      });
  
      // Control buttons
      document.getElementById('refreshBtn').addEventListener('click', () => {
        this.refreshBookmarks();
      });
  
      document.getElementById('clearAllBtn').addEventListener('click', () => {
        this.clearAllBookmarks();
      });
    }
  
    filterBookmarks(searchTerm) {
      const term = searchTerm.toLowerCase();
      this.filteredBookmarks = this.bookmarks.filter(bookmark =>
        bookmark.text.toLowerCase().includes(term) ||
        bookmark.pageTitle.toLowerCase().includes(term) ||
        bookmark.platform.toLowerCase().includes(term)
      );
      this.renderBookmarks();
    }
  
    async refreshBookmarks() {
      // Show refreshing status
      const container = document.getElementById('bookmarksContainer');
      const originalContent = container.innerHTML;
      
      // Create status message at the top
      const statusDiv = document.createElement('div');
      statusDiv.className = 'refresh-status';
      statusDiv.textContent = 'Refreshing...';
      container.insertBefore(statusDiv, container.firstChild);
      
      // Disable refresh button
      const refreshBtn = document.getElementById('refreshBtn');
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      
      // Load bookmarks
      await this.loadBookmarks();
      
      // Update UI
      this.renderBookmarks();
      
      // Show success message briefly
      const successDiv = document.createElement('div');
      successDiv.className = 'refresh-status success';
      successDiv.textContent = 'Refreshed!';
      container.insertBefore(successDiv, container.firstChild);
      
      // Reset button
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
      
      // Remove success message after a delay
      setTimeout(() => {
        const statusElement = container.querySelector('.refresh-status.success');
        if (statusElement) {
          statusElement.remove();
        }
      }, 2000);
    }
  
    async clearAllBookmarks() {
      if (confirm('Are you sure you want to delete all bookmarks? This action cannot be undone.')) {
        await chrome.storage.local.set({ bookmarks: [] });
        this.bookmarks = [];
        this.filteredBookmarks = [];
        this.renderBookmarks();
      }
    }
  
    renderBookmarks() {
      const container = document.getElementById('bookmarksContainer');
      
      if (this.filteredBookmarks.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>${this.bookmarks.length === 0 ? 'No bookmarks yet' : 'No matching bookmarks'}</h3>
            <p>${this.bookmarks.length === 0 
              ? 'Select text in Claude or ChatGPT conversations and click the bookmark button to save important moments.'
              : 'Try adjusting your search terms.'
            }</p>
          </div>
        `;
        return;
      }
  
      container.innerHTML = this.filteredBookmarks.map(bookmark => `
        <div class="bookmark-item" data-bookmark-id="${bookmark.id}">
          <div class="bookmark-text">${this.escapeHtml(bookmark.text)}</div>
          <div class="bookmark-meta">
            <div>
              <span class="bookmark-platform ${bookmark.platform}">${bookmark.platform}</span>
              <span class="bookmark-date">${this.formatDate(bookmark.timestamp)}</span>
            </div>
            <button class="delete-btn" data-bookmark-id="${bookmark.id}">Delete</button>
          </div>
        </div>
      `).join('');
  
      // Add event listeners to bookmark items
      container.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            this.deleteBookmark(e.target.dataset.bookmarkId);
          } else {
            this.navigateToBookmark(item.dataset.bookmarkId);
          }
        });
      });
    }
  
    async deleteBookmark(bookmarkId) {
      if (confirm('Delete this bookmark?')) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
        this.filteredBookmarks = this.filteredBookmarks.filter(b => b.id !== bookmarkId);
        
        await chrome.storage.local.set({ bookmarks: this.bookmarks });
        this.renderBookmarks();
      }
    }
  
    async navigateToBookmark(bookmarkId) {
      const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
      if (!bookmark) return;
  
      try {
        // Get the current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check if we're already on the right page
        if (tab.url === bookmark.url) {
          // Same page, just scroll to bookmark
          await chrome.tabs.sendMessage(tab.id, {
            action: 'scrollToBookmark',
            bookmark: bookmark
          });
        } else {
          // Different page, navigate first then scroll
          await chrome.tabs.update(tab.id, { url: bookmark.url });
          
          // Wait for page to load, then scroll
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'scrollToBookmark',
                  bookmark: bookmark
                });
              }, 1000);
            }
          });
        }
        
        // Close popup
        window.close();
      } catch (error) {
        console.error('Error navigating to bookmark:', error);
        alert('Could not navigate to bookmark. Make sure the page is still accessible.');
      }
    }
  
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  
    formatDate(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
  
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString();
    }
  }
  
  // Initialize popup when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    new BookmarkPopup();
  });