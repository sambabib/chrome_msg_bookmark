let enabled = false; // Start disabled by default for safety
let iconButton = null;

// Initialize the extension state when content script loads
function initializeState() {
    chrome.storage.sync.get(['enabled'], (data) => {
        enabled = data.enabled || false;
        console.log('Extension state initialized:', enabled);

        // If enabled on load, show the indicator
        if (enabled) {
            initializeUI();
        }
    });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);

    if (message.type === 'TOGGLE_STATE') {
        enabled = message.enabled;
        console.log('Extension state toggled to:', enabled);

        if (enabled) {
            initializeUI();
        } else {
            removeStatusIndicator();
            removePinButton(); // Also remove any active pin buttons
            removePinIndicators(); // Remove pin indicators
        }
        sendResponse({ success: true });
    } else if (message.type === 'JUMP_TO_MESSAGE') {
        jumpToMessage(message.bookmark);
        sendResponse({ success: true });
    } else if (message.type === 'REFRESH_PINS') {
        if (enabled) {
            loadAndMarkExistingPins();
        }
        sendResponse({ success: true });
    }

    return true; // Keep the message channel open for async responses
});

// Simple status indicator
function showStatusIndicator() {
    removeStatusIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'gpt-pinner-indicator';
    indicator.textContent = '📌';
    indicator.title = 'Chat Message Pinner is active. Select text to pin it.';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2196F3;
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        z-index: 10000;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        opacity: 0.8;
        transition: opacity 0.2s;
    `;

    indicator.addEventListener('mouseover', function () {
        this.style.opacity = '1';
    });

    indicator.addEventListener('mouseout', function () {
        this.style.opacity = '0.8';
    });

    indicator.addEventListener('click', () => {
        alert('Chat Message Pinner is active. Select text to pin it.');
    });

    document.body.appendChild(indicator);
}

function removeStatusIndicator() {
    const indicator = document.getElementById('gpt-pinner-indicator');
    if (indicator) indicator.remove();
}

// Detect text selection - only show pin button if enabled
document.addEventListener('mouseup', function (e) {
    // Always log selection for debugging
    const selection = window.getSelection();
    const text = selection.toString().trim();

    console.log('Text selected:', text ? text.substring(0, 30) + '...' : 'None',
        'Platform:', detectPlatform(),
        'Enabled:', enabled);

    if (!enabled) {
        console.log('Extension is disabled, not showing pin button');
        return;
    }

    if (text && text.length > 5) { // Only show for meaningful selections
        showPinButton(e.clientX, e.clientY, selection);
    } else {
        removePinButton();
    }
});

// Updated function to detect platform with more reliable checks
function detectPlatform() {
    const url = window.location.href;
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
        return 'chatgpt';
    } else if (url.includes('claude.ai')) {
        return 'claude';
    } else if (url.includes('grok.x.ai')) {
        return 'grok';
    }
    return 'unknown';
}

// Make the button more stable with fixed positioning
function showPinButton(x, y, selection) {
    removePinButton();

    // Get the selection range position for more stable positioning
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Use the range position instead of mouse position when available
    const buttonX = rect.width > 10 ? (rect.left + rect.width / 2) : x;
    const buttonY = rect.height > 5 ? rect.top : y;

    iconButton = document.createElement('button');
    iconButton.id = 'message-pinner-button';
    iconButton.innerHTML = '<span style="margin-right:4px;">📌</span> Pin Message';
    iconButton.style.cssText = `
        position: fixed;
        left: ${buttonX}px;
        top: ${buttonY - 45}px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        z-index: 100000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        transform: translateX(-50%);
        transition: background-color 0.2s;
        user-select: none;
        pointer-events: auto;
    `;

    iconButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = '#0b7dda';
    });

    iconButton.addEventListener('mouseout', function () {
        this.style.backgroundColor = '#2196F3';
    });

    // Prevent the button from moving after it appears
    iconButton.addEventListener('mousedown', function (e) {
        e.stopPropagation();
    });

    iconButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Pin button clicked');
        pinSelectedText(selection);
        removePinButton();
    });

    document.body.appendChild(iconButton);

    // Position check - if button is off-screen, reposition it
    const btnRect = iconButton.getBoundingClientRect();
    if (btnRect.left < 0) {
        iconButton.style.left = '20px';
        iconButton.style.transform = 'none';
    } else if (btnRect.right > window.innerWidth) {
        iconButton.style.left = 'auto';
        iconButton.style.right = '20px';
        iconButton.style.transform = 'none';
    }

    // If the button is too close to the top of the viewport
    if (btnRect.top < 10) {
        iconButton.style.top = (buttonY + 30) + 'px';
    }

    // Make the button stay in position even when other UI events happen
    function preventButtonMovement(e) {
        if (iconButton && !e.target.closest('#message-pinner-button')) {
            // Don't remove the button on these events, unless they're outside the button
            e.stopPropagation();
        }
    }

    // Use a timeout to keep the button visible for a fixed period (optional)
    setTimeout(() => {
        if (iconButton) {
            removePinButton();
        }
    }, 5000); // 5 seconds timeout
}

function removePinButton() {
    if (iconButton) {
        iconButton.remove();
        iconButton = null;
    }
}

// Store the selected text with location data
function pinSelectedText(selection) {
    const text = selection.toString().trim();
    if (!text) {
        showConfirmation('No text selected to pin', true);
        return;
    }

    console.log('Pinning text:', text.substring(0, 30) + '...');

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Find a good container element to use for later reference
    let element = container;
    if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentNode;
    }

    // Try to find the most relevant parent container based on platform
    const platform = detectPlatform();
    let messageContainer = null;

    if (platform === 'chatgpt') {
        messageContainer = element.closest('.markdown') || element;
    } else if (platform === 'claude') {
        messageContainer = element.closest('.prose') || element;
    } else if (platform === 'grok') {
        messageContainer = element.closest('.message-content') || element.closest('.message') || element;
    }

    // Get some context to help find this element later
    const surroundingText = getSurroundingText(messageContainer || element);

    // Create a bookmark with multiple ways to find this element later
    const bookmark = {
        text,
        textContext: surroundingText,
        xpath: generateXPath(messageContainer || element),
        selector: generateSelector(messageContainer || element),
        timestamp: Date.now(),
        url: window.location.href,
        platform: platform,
        // Store selection range info for more precise highlighting
        selectionStart: range.startOffset,
        selectionEnd: range.endOffset
    };

    console.log('Created bookmark:', bookmark);

    // Save the bookmark with explicit error handling
    chrome.storage.sync.get(['pinnedMessages', 'maxPins'], function (data) {
        try {
            const messages = data.pinnedMessages || [];
            // Default max pins is 50 if not set
            const maxPins = data.maxPins || 50;

            // Check for duplicates
            const isDuplicate = messages.some(msg => 
                msg.text === bookmark.text && 
                msg.url === bookmark.url
            );

            if (isDuplicate) {
                showConfirmation('This text is already pinned!', true);
                return;
            }

            // Add the new bookmark
            messages.push(bookmark);

            // Check if we've exceeded max pins
            checkAndCleanPins();

            chrome.storage.sync.set({ pinnedMessages: messages }, function () {
                if (chrome.runtime.lastError) {
                    console.error('Error saving pinned message:', chrome.runtime.lastError);
                    showConfirmation('Error saving message: ' + chrome.runtime.lastError.message, true);
                } else {
                    console.log('Message pinned successfully. Total pins:', messages.length);
                    showConfirmation('Message pinned successfully!');
                    
                    // Add visual indicator to the pinned message
                    addPinIndicator(messageContainer || element, bookmark);
                }
            });
        } catch (e) {
            console.error('Error processing pinned messages:', e);
            showConfirmation('Error saving message: ' + e.message, true);
        }
    });
}

// Check if we've exceeded max pins
function checkAndCleanPins() {
    chrome.storage.sync.get(['pinnedMessages', 'maxPins'], function (data) {
        const messages = data.pinnedMessages || [];
        if (messages.length === 0) return;

        const maxPins = data.maxPins || 50;

        // Sort by timestamp (newest first)
        messages.sort((a, b) => b.timestamp - a.timestamp);

        // Apply max pins limit
        const finalMessages = messages.slice(0, maxPins);

        // Only update if we removed any messages
        if (finalMessages.length < messages.length) {
            chrome.storage.sync.set({ pinnedMessages: finalMessages }, () => {
                console.log(`Applied max pins limit. Removed ${messages.length - finalMessages.length} old pins.`);
            });
        }
    });
}

// Add a visual pin indicator to the message that was pinned
function addPinIndicator(element, bookmark) {
    // Check if this element already has a pin indicator
    if (element.querySelector('.message-pin-indicator')) {
        return; // Already has a pin indicator
    }
    
    const pinIndicator = document.createElement('div');
    pinIndicator.className = 'message-pin-indicator';
    pinIndicator.innerHTML = '📌';
    pinIndicator.title = 'This message is pinned. Click to view in popup.';
    pinIndicator.setAttribute('data-pin-id', bookmark.timestamp);
    
    pinIndicator.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        background: #2196F3;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        z-index: 1000;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        margin: 8px;
        transition: transform 0.2s;
    `;
    
    pinIndicator.addEventListener('mouseover', function() {
        this.style.transform = 'scale(1.1)';
    });
    
    pinIndicator.addEventListener('mouseout', function() {
        this.style.transform = 'scale(1)';
    });
    
    pinIndicator.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: "openPopup" });
    });
    
    // Make sure the element has position relative for absolute positioning of the indicator
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
        element.style.position = 'relative';
    }
    
    element.appendChild(pinIndicator);
}

// Load existing pins and mark them on the page
function loadAndMarkExistingPins() {
    if (!enabled) return;
    
    chrome.storage.sync.get(['pinnedMessages'], function(data) {
        const messages = data.pinnedMessages || [];
        const currentUrl = window.location.href;
        
        // Filter pins for the current page
        const pagePins = messages.filter(pin => {
            // Match on domain and path, ignore query params
            const pinUrlObj = new URL(pin.url);
            const currentUrlObj = new URL(currentUrl);
            return pinUrlObj.hostname === currentUrlObj.hostname && 
                   pinUrlObj.pathname === currentUrlObj.pathname;
        });
        
        console.log(`Found ${pagePins.length} pins for this page`);
        
        // Try to find and mark each pinned message
        pagePins.forEach(pin => {
            setTimeout(() => {
                try {
                    // Try to find the element using various methods
                    let element = null;
                    
                    // Try XPath
                    if (pin.xpath) {
                        try {
                            const result = document.evaluate(
                                pin.xpath, document, null, 
                                XPathResult.FIRST_ORDERED_NODE_TYPE, null
                            );
                            if (result.singleNodeValue) {
                                element = result.singleNodeValue;
                            }
                        } catch (e) {
                            console.warn('XPath lookup failed:', e);
                        }
                    }
                    
                    // Try CSS selector
                    if (!element && pin.selector) {
                        try {
                            element = document.querySelector(pin.selector);
                        } catch (e) {
                            console.warn('CSS selector lookup failed:', e);
                        }
                    }
                    
                    // If we found the element, mark it
                    if (element) {
                        addPinIndicator(element, pin);
                    }
                } catch (e) {
                    console.error('Error marking pinned message:', e);
                }
            }, 500); // Small delay to ensure DOM is ready
        });
    });
}

// Call this when the extension is enabled
function initializeUI() {
    if (enabled) {
        showStatusIndicator();
        loadAndMarkExistingPins();
    } else {
        removeStatusIndicator();
        removePinIndicators();
    }
}

// Remove all pin indicators
function removePinIndicators() {
    const indicators = document.querySelectorAll('.message-pin-indicator');
    indicators.forEach(indicator => indicator.remove());
}

// Get surrounding text to help find this element later
function getSurroundingText(element) {
    let context = '';
    try {
        // Try to get some parent context
        let parent = element;
        for (let i = 0; i < 3; i++) {
            if (parent && parent.textContent) {
                const text = parent.textContent.trim();
                if (text.length > context.length) {
                    context = text.substring(0, 150);
                }
            }
            if (parent.parentNode) {
                parent = parent.parentNode;
            } else {
                break;
            }
        }
    } catch (e) {
        console.error('Error getting surrounding text:', e);
    }
    return context;
}

// Generate an XPath for the element
function generateXPath(element) {
    try {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }

        // For specific platforms, use known patterns
        const platform = detectPlatform();
        if (platform === 'chatgpt') {
            // Look for message containers
            const messageElement = element.closest('.markdown');
            if (messageElement) {
                return getXPathForElement(messageElement);
            }
        } else if (platform === 'claude') {
            // Claude-specific containers
            const messageElement = element.closest('.prose');
            if (messageElement) {
                return getXPathForElement(messageElement);
            }
        } else if (platform === 'grok') {
            // Grok-specific containers
            const messageElement = element.closest('.message-content') || element.closest('.message');
            if (messageElement) {
                return getXPathForElement(messageElement);
            }
        }

        // Generic fallback
        return getXPathForElement(element);
    } catch (e) {
        console.error('Error generating XPath:', e);
        return null;
    }
}

function getXPathForElement(element) {
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = element;
        while ((sibling = sibling.previousElementSibling)) {
            if (sibling.tagName === element.tagName) index++;
        }

        const tagName = element.tagName.toLowerCase();
        const part = index > 1 ? `${tagName}[${index}]` : tagName;
        parts.unshift(part);

        element = element.parentNode;
    }
    return `/${parts.join('/')}`;
}

// Generate a CSS selector for the element
function generateSelector(element) {
    try {
        if (element.id) {
            return `#${element.id}`;
        }

        // Platform-specific selectors
        const platform = detectPlatform();
        if (platform === 'chatgpt') {
            const messageElement = element.closest('.markdown');
            if (messageElement) {
                return '.markdown:contains(' + element.textContent.substring(0, 30).replace(/[^\w\s]/g, '') + ')';
            }
        } else if (platform === 'claude') {
            const messageElement = element.closest('.prose');
            if (messageElement) {
                return '.prose:contains(' + element.textContent.substring(0, 30).replace(/[^\w\s]/g, '') + ')';
            }
        } else if (platform === 'grok') {
            // Add Grok-specific selector
            const messageElement = element.closest('.message-content') || element.closest('.message');
            if (messageElement) {
                return (messageElement.classList.contains('message-content') ? '.message-content' : '.message') + 
                       ':contains(' + element.textContent.substring(0, 30).replace(/[^\w\s]/g, '') + ')';
            }
        }

        // Generic approach
        const classes = Array.from(element.classList);
        if (classes.length > 0) {
            return '.' + classes.join('.');
        }

        return element.tagName.toLowerCase();
    } catch (e) {
        console.error('Error generating selector:', e);
        return null;
    }
}

// Show a confirmation message
function showConfirmation(message, isError = false) {
    // Check if toast notification system is available
    if (!window.pinnerToast) {
        // Fallback to the original confirmation UI
        const confirmation = document.createElement('div');
        const styles = document.createElement('style');
        
        styles.textContent = `
            .pinner-confirmation {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 20px;
                background-color: ${isError ? '#f44336' : '#4CAF50'};
                color: white;
                border-radius: 4px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                animation: pinner-fade 4s forwards;
            }
            
            @keyframes pinner-fade {
                0% { opacity: 0; transform: translateY(20px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-20px); }
            }
        `;
        
        document.head.appendChild(styles);
        confirmation.textContent = message;
        
        // Remove any existing confirmation
        const existingConfirmation = document.querySelector('.pinner-confirmation');
        if (existingConfirmation) {
            existingConfirmation.remove();
        }
        
        confirmation.className = 'pinner-confirmation';
        document.body.appendChild(confirmation);
        
        // Remove the elements after animation completes
        setTimeout(() => {
            confirmation.remove();
            styles.remove();
        }, 4000);
    } else {
        // Use the toast notification system
        if (isError) {
            window.pinnerToast.error(message);
        } else {
            window.pinnerToast.success(message);
        }
    }
}

// Jump to message (called from popup)
function jumpToMessage(bookmark) {
    console.log('Jumping to message:', bookmark);

    let element = null;
    const platform = detectPlatform();

    // Try multiple strategies to find the element
    if (bookmark.xpath) {
        try {
            element = document.evaluate(
                bookmark.xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;
            console.log('Found by XPath:', element);
        } catch (e) {
            console.warn('XPath evaluation failed:', e);
        }
    }

    // Try by selector with platform-specific optimizations
    if (!element && bookmark.selector) {
        try {
            // Try to find elements that match the selector
            const elements = document.querySelectorAll(bookmark.selector);
            console.log(`Found ${elements.length} elements matching selector:`, bookmark.selector);
            
            // If multiple elements match, try to find the one containing our text
            if (elements.length > 1 && bookmark.text) {
                for (const el of elements) {
                    if (el.textContent.includes(bookmark.text)) {
                        element = el;
                        console.log('Found matching element by text content within selector:', element);
                        break;
                    }
                }
            } else if (elements.length === 1) {
                element = elements[0];
            }
        } catch (e) {
            console.warn('Selector query failed:', e);
        }
    }

    // Try platform-specific selectors if the above methods failed
    if (!element) {
        try {
            let platformSelectors = [];
            
            if (platform === 'chatgpt' || bookmark.platform === 'chatgpt') {
                platformSelectors = ['.markdown', '.text-message', '.message-content'];
            } else if (platform === 'claude' || bookmark.platform === 'claude') {
                platformSelectors = ['.prose', '.message-content', '.claude-message'];
            } else if (platform === 'grok' || bookmark.platform === 'grok') {
                platformSelectors = ['.message-content', '.message', '.grok-message'];
            }
            
            for (const selector of platformSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    if (el.textContent.includes(bookmark.text)) {
                        element = el;
                        console.log(`Found by platform-specific selector ${selector}:`, element);
                        break;
                    }
                }
                if (element) break;
            }
        } catch (e) {
            console.warn('Platform-specific search failed:', e);
        }
    }

    // Try by text content as a fallback
    if (!element && bookmark.text) {
        const elements = document.querySelectorAll('p, div, span');
        for (const el of elements) {
            if (el.textContent.includes(bookmark.text)) {
                element = el;
                console.log('Found by text content:', element);
                break;
            }
        }
    }

    // Try by surrounding text
    if (!element && bookmark.textContext) {
        const contextWords = bookmark.textContext.split(/\s+/).filter(w => w.length > 5);
        const elements = document.querySelectorAll('p, div, span');

        for (const el of elements) {
            const matches = contextWords.filter(word =>
                el.textContent.includes(word)
            ).length;

            if (matches > 2) {
                element = el;
                console.log('Found by context words:', element);
                break;
            }
        }
    }

    if (element) {
        // Scroll to the element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight the element
        const originalBackground = element.style.backgroundColor;
        element.style.backgroundColor = 'rgba(33, 150, 243, 0.3)';

        setTimeout(() => {
            element.style.backgroundColor = originalBackground;
        }, 2000);
        
        return true;
    } else {
        console.error('Could not find the pinned message');
        showConfirmation('Could not find the pinned message. It may have been removed or the conversation was reset.', true);
        return false;
    }
}

// Load initial state
initializeState();
console.log('Message Pinner content script loaded - works with ChatGPT, Claude, and Grok');