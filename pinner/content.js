class ChatBookmarks {
    constructor() {
      // Check if Chrome API is available
      this.chromeApiAvailable = typeof chrome !== 'undefined' && 
                               chrome && 
                               chrome.runtime && 
                               chrome.storage && 
                               chrome.storage.local;
      
      if (!this.chromeApiAvailable) {
        console.error('Chrome API not available. Extension may not function correctly.');
      }
      
      this.platform = this.detectPlatform();
      this.bookmarkButton = null;
      this.init();
    }
  
    detectPlatform() {
      const hostname = window.location.hostname;
      const url = window.location.href;
      
      console.log('Detecting platform from URL:', url);
      
      if (hostname.includes('claude.ai')) {
        console.log('Platform detected: Claude');
        return 'claude';
      }
      
      if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) {
        console.log('Platform detected: ChatGPT');
        return 'chatgpt';
      }
      
      console.log('Platform not detected');
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
      // Create button if it doesn't exist
      if (!this.bookmarkButton) {
        this.bookmarkButton = document.createElement('button');
        this.bookmarkButton.id = 'chat-bookmark-btn';
        this.bookmarkButton.innerHTML = '⚡ Bookmark this';
        this.bookmarkButton.style.display = 'none';
        document.body.appendChild(this.bookmarkButton);
        
        // Add click event
        this.bookmarkButton.addEventListener('click', () => {
          this.bookmarkSelection();
          this.bookmarkButton.style.display = 'none';
        });
      }
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
          if (current.matches('[data-message-author-role]')) {
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
        return document.querySelectorAll('[data-message-author-role]');
      }
      return [];
    }
  
    getMessageSelector() {
      if (this.platform === 'claude') {
        return '[data-testid*="conversation-turn"], .font-claude-message';
      } else if (this.platform === 'chatgpt') {
        return '[data-message-author-role]';
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
      
      try {
        // Store bookmark using Chrome storage API
        if (chrome && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get(['bookmarks']);
          const bookmarks = result.bookmarks || [];
          bookmarks.push(bookmark);
          await chrome.storage.local.set({ bookmarks });
          console.log('Bookmark saved successfully');
        } else {
          console.error('Chrome storage API not available');
          throw new Error('Chrome storage API not available');
        }
      } catch (error) {
        console.error('Error saving bookmark:', error);
        this.showNotification('Error saving bookmark. Please try again.');
        return;
      }
  
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
    // Ensure chrome API is available
    if (!chrome || !chrome.runtime) {
      console.error('Chrome runtime API not available');
      return;
    }

    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Log incoming messages for debugging
        console.log('Message received:', request.action);
        
        if (request.action === 'scrollToBookmark') {
          try {
            this.scrollToBookmark(request.bookmark);
            // The popup may have been closed, so sending a response can fail.
            try {
              sendResponse({ success: true });
            } catch (error) {
              // This is expected if the popup closed, so we can ignore it.
              if (!error.message.includes('context invalidated')) {
                console.error('Error sending response for scrollToBookmark:', error);
              }
            }
          } catch (error) {
            console.error('Error in scrollToBookmark:', error);
            try {
              sendResponse({ success: false, error: error.message });
            } catch (responseError) {
              console.error('Error sending error response:', responseError);
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
          try {
            sendResponse({ success: false, error: 'Not implemented' });
          } catch (error) {
            console.error('Error sending response for bookmarkSelection:', error);
          }
          return;
        }

        // IMPORTANT: For any other messages, we do not return `true`.
        // This signals that this listener will not send a response for this message,
        // allowing other listeners (like in background.js) to do so asynchronously
        // without causing a "message port closed" error.
      });
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  } 
  
    scrollToBookmark(bookmark) {
    console.log(`Attempting to find text in ${this.platform}:`, bookmark.text.substring(0, 50) + '...');
    
    // First try to find the exact text using full text if available
    let found = null;
    if (bookmark.fullText && bookmark.fullText.length > 0) {
      console.log('Searching using full text');
      found = this.findTextInPage(bookmark.fullText);
    }
    
    // If full text search failed, try with the shorter text
    if (!found && bookmark.text) {
      console.log('Full text search failed, trying with shorter text');
      found = this.findTextInPage(bookmark.text);
    }
    
    if (found) {
      console.log('Found text match:', found);
      
      // First scroll to the element to ensure it's in view
      found.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Wait a moment for the scroll to complete before highlighting
      setTimeout(() => {
        this.highlightText(found, bookmark.text || bookmark.fullText);
      }, 300);
      
      return true;
    } else {
      console.log('No text match found at all');
      this.showNotification('Bookmark location not found. The conversation may have changed.');
      return false;
    }
  }
    
    findTextInPage(searchText) {
      if (!searchText || searchText.length < 3) {
        console.log('Search text too short or empty');
        return null;
      }
      
      console.log(`Finding text in ${this.platform} using ${searchText.length} chars of text`);
      
      // Platform-specific search optimizations
      if (this.platform === 'chatgpt') {
        console.log('Using ChatGPT-specific text finder');
        return this.findTextInChatGPT(searchText);
      }
      
      console.log('Using Claude-specific text finder');
      return this.findTextInClaude(searchText);
    }
    
    findTextInClaude(searchText) {
      // For Claude, first try to find in message containers
      const claudeMessages = document.querySelectorAll('[data-testid*="conversation-turn"], .font-claude-message');
      console.log(`Found ${claudeMessages.length} Claude message containers`);
      
      // First try to find the exact text in specific elements within Claude messages
      for (const container of claudeMessages) {
        if (container.textContent.includes(searchText)) {
          console.log('Found Claude container with matching text');
          
          // Look for paragraphs first (most common text container)
          const paragraphs = container.querySelectorAll('p');
          for (const p of paragraphs) {
            if (p.textContent.includes(searchText)) {
              console.log('Found paragraph with exact match in Claude');
              return p;
            }
          }
          
          // Then try other text elements
          const textElements = container.querySelectorAll('span, div, li, pre, code');
          for (const el of textElements) {
            // Only consider elements that aren't too large
            if (el.textContent.length < searchText.length * 3 && 
                el.textContent.includes(searchText)) {
              console.log('Found specific element with text in Claude:', el.tagName);
              return el;
            }
          }
          
          // If no specific element found, try to find the exact text node
          const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent.includes(searchText)) {
              console.log('Found exact text node in Claude');
              return node.parentElement;
            }
          }
          
          // If all else fails, return the container
          return container;
        }
      }
      
      // Fallback: Generic search method for any platform
      console.log('No match in Claude containers, trying generic search');
      const genericWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let textNode;
      while (textNode = genericWalker.nextNode()) {
        if (textNode.textContent.includes(searchText)) {
          console.log('Found text with generic search');
          return textNode.parentElement;
        }
      }

      // Try fuzzy matching for partial text
      const searchWords = searchText.split(' ').filter(w => w.length > 3);
      if (searchWords.length > 0) {
        const fuzzyWalker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let bestMatch = null;
        let bestScore = 0;

        let fuzzyNode;
        while (fuzzyNode = fuzzyWalker.nextNode()) {
          const content = fuzzyNode.textContent;
          let score = 0;
          searchWords.forEach(word => {
            if (content.includes(word)) score++;
          });
          
          if (score > bestScore && score > searchWords.length * 0.5) {
            bestScore = score;
            bestMatch = fuzzyNode.parentElement;
          }
        }
        
        console.log('Found fuzzy match with score:', bestScore);
        return bestMatch;
      }
      
      return null;
    }
    
    findTextInChatGPT(searchText) {
      // First try to find in message containers directly
      const messageContainers = document.querySelectorAll('[data-message-author-role]');
      console.log(`Found ${messageContainers.length} ChatGPT message containers to search in`);
      
      // Normalize the search text to improve matching
      const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, ' ').trim();
      console.log('Normalized search text:', normalizedSearch.substring(0, 50) + '...');
      
      // Enhanced text finding approach for ChatGPT
      // First pass: try exact matches in message containers
      for (const container of messageContainers) {
        const containerText = container.textContent.toLowerCase();
        if (containerText.includes(normalizedSearch)) {
          console.log('Found container with matching text');
          
          // APPROACH 1: Try to find the exact text in paragraphs (most common text container in ChatGPT)
          // This works best for regular text content
          const paragraphs = container.querySelectorAll('p');
          for (const p of paragraphs) {
            if (p.textContent.toLowerCase().includes(normalizedSearch)) {
              console.log('Found paragraph with exact match');
              
              // Try to find even more specific text node or span within the paragraph
              // This helps target the exact text rather than the whole paragraph
              const spans = p.querySelectorAll('span');
              for (const span of spans) {
                if (span.textContent.toLowerCase().includes(normalizedSearch)) {
                  console.log('Found span with exact text');
                  
                  // Highlight the span and return it
                  span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  return span;
                }
              }
              
              // If no span found, try direct text nodes for maximum precision
              const textNodeWalker = document.createTreeWalker(
                p,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              let textNode;
              while (textNode = textNodeWalker.nextNode()) {
                if (textNode.textContent.toLowerCase().includes(normalizedSearch)) {
                  console.log('Found exact text node within paragraph');
                  return textNode.parentElement;
                }
              }
              
              // If no specific element found within paragraph, return the paragraph itself
              return p;
            }
          }
          
          // APPROACH 2: Try other semantic elements that might contain the text
          // This works well for lists, code blocks, and headings
          const semanticElements = container.querySelectorAll('li, pre, code, h1, h2, h3, h4, h5, h6');
          for (const el of semanticElements) {
            if (el.textContent.toLowerCase().includes(normalizedSearch)) {
              console.log('Found semantic element with text:', el.tagName);
              return el;
            }
          }
          
          // APPROACH 3: Try to find the smallest possible element containing the text
          // This works well for text that might be in divs or other containers
          const allElements = container.querySelectorAll('*');
          let bestElement = null;
          let bestLength = Infinity;
          
          for (const el of allElements) {
            const elText = el.textContent.toLowerCase();
            if (elText.includes(normalizedSearch)) {
              // Prefer elements that are close in size to our search text
              if (el.children.length === 0 && elText.length < bestLength) {
                bestLength = elText.length;
                bestElement = el;
              }
            }
          }
          
          if (bestElement) {
            console.log('Found best matching element, size:', bestLength);
            return bestElement;
          }
          
          // APPROACH 4: Direct text node search as last resort
          // This gives us the most precise text location possible
          const containerWalker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let containerNode;
          let bestNode = null;
          let bestNodeLength = Infinity;
          
          while (containerNode = containerWalker.nextNode()) {
            const nodeText = containerNode.textContent.toLowerCase();
            if (nodeText.includes(normalizedSearch)) {
              // If we find a text node with similar length to our search text, it's likely the best match
              if (Math.abs(nodeText.length - normalizedSearch.length) < normalizedSearch.length * 0.5) {
                console.log('Found perfect text node match');
                return containerNode.parentElement;
              }
              
              // Otherwise track the smallest containing node
              if (nodeText.length < bestNodeLength) {
                bestNodeLength = nodeText.length;
                bestNode = containerNode;
              }
            }
          }
          
          if (bestNode) {
            console.log('Found best text node match');
            return bestNode.parentElement;
          }
          
          console.log('Falling back to container');
          return container; // If no specific element found, return the container
        }
      }
      
      // Second pass: try fuzzy matching with individual words
      const words = normalizedSearch.split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const container of messageContainers) {
          const containerText = container.textContent.toLowerCase();
          let score = 0;
          
          words.forEach(word => {
            if (containerText.includes(word)) score++;
          });
          
          if (score > bestScore && score > words.length * 0.4) { // Lower threshold for ChatGPT
            bestScore = score;
            bestMatch = container;
          }
        }
        
        if (bestMatch) {
          return bestMatch;
        }
      }
      
      // Last resort: fallback to the default method
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      let bestMatch = null;
      let bestScore = 0;
      
      while (node = walker.nextNode()) {
        const content = node.textContent.toLowerCase();
        
        // Try exact match first
        if (content.includes(normalizedSearch)) {
          return node.parentElement;
        }
        
        // Then try word matching
        if (words.length > 0) {
          let score = 0;
          words.forEach(word => {
            if (content.includes(word)) score++;
          });
          
          if (score > bestScore && score > words.length * 0.3) { // Even lower threshold for last resort
            bestScore = score;
            bestMatch = node.parentElement;
          }
        }
      }
      
      return bestMatch;
    }
    
    highlightText(element, searchText) {
      // Remove any existing highlights
      const existingHighlights = document.querySelectorAll('.bookmark-highlight');
      existingHighlights.forEach(el => {
        el.classList.remove('bookmark-highlight');
        // Remove any highlight spans we've injected
        const highlightSpans = el.querySelectorAll('.bookmark-highlight-span');
        highlightSpans.forEach(span => {
          // Replace the span with its text content
          if (span.parentNode) {
            span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
          }
        });
      });
      
      // Add highlight class to the element
      element.classList.add('bookmark-highlight');
      
      // Create or update the highlight style
      let highlightStyle = document.getElementById('bookmark-highlight-style');
      if (!highlightStyle) {
        highlightStyle = document.createElement('style');
        highlightStyle.id = 'bookmark-highlight-style';
        document.head.appendChild(highlightStyle);
      }
      
      highlightStyle.textContent = `
        .bookmark-highlight {
          background-color: rgba(255, 255, 0, 0.1) !important;
          outline: 2px solid rgba(255, 200, 0, 0.5) !important;
          transition: all 0.5s ease-in-out;
        }
        .bookmark-highlight-span {
          background-color: rgba(255, 255, 0, 0.5) !important;
          outline: 1px solid rgba(255, 200, 0, 0.8) !important;
          border-radius: 2px;
          transition: all 0.5s ease-in-out;
        }
      `;
      
      // If we have search text, try to highlight the exact text within the element
      if (searchText && element.textContent.includes(searchText)) {
        try {
          // Only highlight text nodes, not elements with children
          if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
            const text = element.textContent;
            const index = text.indexOf(searchText);
            if (index >= 0) {
              // Split the text node and wrap the search text in a highlight span
              const before = text.substring(0, index);
              const match = text.substring(index, index + searchText.length);
              const after = text.substring(index + searchText.length);
              
              element.innerHTML = '';
              if (before) element.appendChild(document.createTextNode(before));
              
              const highlightSpan = document.createElement('span');
              highlightSpan.textContent = match;
              highlightSpan.className = 'bookmark-highlight-span';
              element.appendChild(highlightSpan);
              
              if (after) element.appendChild(document.createTextNode(after));
              
              console.log('Applied precise text highlighting');
            }
          }
        } catch (error) {
          console.error('Error during precise text highlighting:', error);
        }
      }
      
      // Remove highlight after a few seconds
      setTimeout(() => {
        element.classList.remove('bookmark-highlight');
        // Remove any highlight spans we've injected
        const highlightSpans = element.querySelectorAll('.bookmark-highlight-span');
        highlightSpans.forEach(span => {
          // Replace the span with its text content
          if (span.parentNode) {
            span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
          }
        });
      }, 5000);
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