let enabled = false; // Start disabled by default for safety
let iconButton = null;

// Initialize the extension state when content script loads
function initializeState() {
    chrome.storage.sync.get(['enabled'], (data) => {
        enabled = data.enabled || false;
        console.log('Extension state initialized:', enabled);

        // If enabled on load, show the indicator
        if (enabled) {
            showStatusIndicator();
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
            showStatusIndicator();
        } else {
            removeStatusIndicator();
            removePinButton(); // Also remove any active pin buttons
        }
        sendResponse({ success: true });
    } else if (message.type === 'JUMP_TO_MESSAGE') {
        jumpToMessage(message.bookmark);
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
    }
    // Add other platforms as needed
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
    if (!text) return;

    console.log('Pinning text:', text.substring(0, 30) + '...');

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Find a good container element to use for later reference
    let element = container;
    if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentNode;
    }

    // Get some context to help find this element later
    const surroundingText = getSurroundingText(element);

    // Create a bookmark with multiple ways to find this element later
    const bookmark = {
        text,
        textContext: surroundingText,
        xpath: generateXPath(element),
        selector: generateSelector(element),
        timestamp: Date.now(),
        url: window.location.href,
        platform: detectPlatform()
    };

    console.log('Created bookmark:', bookmark);

    // Save the bookmark with explicit error handling
    chrome.storage.sync.get(['pinnedMessages'], function (data) {
        try {
            const messages = data.pinnedMessages || [];
            messages.push(bookmark);

            chrome.storage.sync.set({ pinnedMessages: messages }, function () {
                if (chrome.runtime.lastError) {
                    console.error('Error saving pinned message:', chrome.runtime.lastError);
                    showConfirmation('Error saving message: ' + chrome.runtime.lastError.message, true);
                } else {
                    console.log('Message pinned successfully. Total pins:', messages.length);
                    showConfirmation('Message pinned successfully!');
                }
            });
        } catch (e) {
            console.error('Error processing pinned messages:', e);
            showConfirmation('Error saving message: ' + e.message, true);
        }
    });
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

// Enhanced confirmation message with optional error state
function showConfirmation(message, isError = false) {
    const confirmation = document.createElement('div');
    confirmation.textContent = isError ? '❌ ' + message : '📌 ' + message;
    confirmation.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${isError ? '#f44336' : '#4CAF50'};
        color: white;
        padding: 10px 16px;
        border-radius: 4px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s, fadeOut 0.3s 1.7s;
    `;

    const styles = document.createElement('style');
    styles.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(20px); }
        }
    `;
    document.head.appendChild(styles);

    document.body.appendChild(confirmation);
    setTimeout(() => {
        confirmation.remove();
        styles.remove();
    }, 2000);
}

// Jump to message (called from popup)
function jumpToMessage(bookmark) {
    console.log('Jumping to message:', bookmark);

    let element = null;

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

    // Try by selector
    if (!element && bookmark.selector) {
        try {
            element = document.querySelector(bookmark.selector);
            console.log('Found by selector:', element);
        } catch (e) {
            console.warn('Selector query failed:', e);
        }
    }

    // Try by text content
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
    } else {
        alert('Could not find the pinned message. It may have been removed or the conversation was reset.');
    }
}

// Load initial state
initializeState();
console.log('Message Pinner content script loaded - works with ChatGPT and Claude');