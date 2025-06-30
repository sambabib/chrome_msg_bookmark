class ChatBookmarks {
    constructor() {
      this.platform = this.detectPlatform();
      this.bookmarkButton = null;
      this.init();
    }
  
    detectPlatform() {
      const hostname = window.location.hostname;
      if (hostname.includes('claude.ai')) return 'claude';
      if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt';
      return null;
    }
  
    init() {
      if (!this.platform) return;
      
      this.createBookmarkButton();
      this.setupSelectionListener();
      this.setupMessageListener();
      
      // Handle dynamic content loading
      this.observeNewMessages();
    }
  
    createBookmarkButton() {
      this.bookmarkButton = document.createElement('div');
      this.bookmarkButton.id = 'chat-bookmark-btn';
      this.bookmarkButton.innerHTML = '📌 Bookmark';
      this.bookmarkButton.style.display = 'none';
      this.bookmarkButton.addEventListener('click', () => this.bookmarkSelection());
      document.body.appendChild(this.bookmarkButton);
    }
  
    setupSelectionListener() {
      document.addEventListener('mouseup', (e) => {
        setTimeout(() => this.handleSelection(), 10);
      });
  
      document.addEventListener('keyup', (e) => {
        setTimeout(() => this.handleSelection(), 10);
      });
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
      // Find the message container for the selected text
      let current = node;
      while (current && current !== document.body) {
        if (current.nodeType === Node.ELEMENT_NODE) {
          // Claude selectors
          if (current.matches('[data-testid*="conversation-turn"]') || 
              current.matches('.font-claude-message') ||
              current.closest('[data-testid*="conversation-turn"]')) {
            return this.generateMessageId(current);
          }
          
          // ChatGPT selectors
          if (current.matches('[data-message-author-role]') ||
              current.matches('.group\\/conversation-turn') ||
              current.closest('[data-message-author-role]')) {
            return this.generateMessageId(current);
          }
        }
        current = current.parentNode;
      }
      return Date.now().toString();
    }
  
    generateMessageId(element) {
      // Create a unique ID based on element position and content
      const messages = this.getAllMessages();
      const index = Array.from(messages).indexOf(element.closest(this.getMessageSelector()));
      return `${this.platform}-msg-${index}-${Date.now()}`;
    }
  
    getAllMessages() {
      if (this.platform === 'claude') {
        return document.querySelectorAll('[data-testid*="conversation-turn"], .font-claude-message');
      } else if (this.platform === 'chatgpt') {
        return document.querySelectorAll('[data-message-author-role], .group\\/conversation-turn');
      }
      return [];
    }
  
    getMessageSelector() {
      if (this.platform === 'claude') {
        return '[data-testid*="conversation-turn"], .font-claude-message';
      } else if (this.platform === 'chatgpt') {
        return '[data-message-author-role], .group\\/conversation-turn';
      }
      return '';
    }
  
    async bookmarkSelection() {
      const text = this.bookmarkButton.dataset.text;
      const messageId = this.bookmarkButton.dataset.messageId;
      
      if (!text || !messageId) return;
  
      const bookmark = {
        id: Date.now().toString(),
        text: text.substring(0, 200), // Limit text length
        fullText: text,
        messageId: messageId,
        url: window.location.href,
        platform: this.platform,
        timestamp: new Date().toISOString(),
        pageTitle: document.title
      };
  
      // Store bookmark
      const result = await chrome.storage.local.get(['bookmarks']);
      const bookmarks = result.bookmarks || [];
      bookmarks.push(bookmark);
      await chrome.storage.local.set({ bookmarks });
  
      // Hide bookmark button
      this.bookmarkButton.style.display = 'none';
      
      // Show confirmation
      this.showNotification('Bookmark saved!');
    }
  
    showNotification(message) {
      const notification = document.createElement('div');
      notification.className = 'chat-bookmark-notification';
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 2000);
    }
  
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrollToBookmark') {
          this.scrollToBookmark(request.bookmark);
          // The popup may have been closed, so sending a response can fail.
          // We'll send it and ignore any errors.
          try {
            sendResponse({ success: true });
          } catch (error) {
            // This is expected if the popup closed, so we can ignore it.
            if (!error.message.includes('context invalidated')) {
              console.error('Error sending response for scrollToBookmark:', error);
            }
          }
          // We've handled this message and responded. Return false or nothing.
          return;
        }

        if (request.action === 'bookmarkSelection') {
          // This message comes from the context menu in the background script.
          // The current bookmarkSelection() method relies on an existing DOM selection,
          // which we don't have here. This needs a refactor to work correctly.
          this.showNotification('Bookmarking from context menu is not fully supported yet.');
          sendResponse({ success: false, error: 'Not implemented' });
          return;
        }

        // IMPORTANT: For any other messages, we do not return `true`.
        // This signals that this listener will not send a response for this message,
        // allowing other listeners (like in background.js) to do so asynchronously
        // without causing a "message port closed" error.
      });
    }
  
    scrollToBookmark(bookmark) {
      // First try to find the exact text
      const found = this.findTextInPage(bookmark.fullText);
      
      if (found) {
        found.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        this.highlightText(found);
      } else {
        // Fallback: try to find partial text or similar content
        const partialFound = this.findTextInPage(bookmark.text);
        if (partialFound) {
          partialFound.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
          this.highlightText(partialFound);
        } else {
          this.showNotification('Bookmark location not found. The conversation may have changed.');
        }
      }
    }
  
    findTextInPage(searchText) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
  
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes(searchText)) {
          return node.parentElement;
        }
      }
  
      // Try fuzzy matching for partial text
      const words = searchText.split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
        const walker2 = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
  
        let bestMatch = null;
        let bestScore = 0;
  
        while (node = walker2.nextNode()) {
          const content = node.textContent;
          let score = 0;
          words.forEach(word => {
            if (content.includes(word)) score++;
          });
          
          if (score > bestScore && score > words.length * 0.5) {
            bestScore = score;
            bestMatch = node.parentElement;
          }
        }
  
        return bestMatch;
      }
  
      return null;
    }
  
    highlightText(element) {
      element.style.backgroundColor = '#ffeb3b';
      element.style.transition = 'background-color 0.3s ease';
      
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 3000);
    }
  
    observeNewMessages() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // New messages might have been added, update our tracking
            this.updateMessageTracking();
          }
        });
      });
  
      // Observe the main chat container
      const chatContainer = this.getChatContainer();
      if (chatContainer) {
        observer.observe(chatContainer, {
          childList: true,
          subtree: true
        });
      }
    }
  
    getChatContainer() {
      if (this.platform === 'claude') {
        return document.querySelector('[data-testid*="conversation"]') || 
               document.querySelector('main') ||
               document.body;
      } else if (this.platform === 'chatgpt') {
        return document.querySelector('[role="main"]') || 
               document.querySelector('.conversation') ||
               document.body;
      }
      return document.body;
    }
  
    updateMessageTracking() {
      // This could be enhanced to update existing bookmark references
      // if the DOM structure changes significantly
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ChatBookmarks();
    });
  } else {
    new ChatBookmarks();
  }