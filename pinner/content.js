let enabled = false;
let iconButton = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_STATE') {
        enabled = message.enabled;
    } else if (message.type === 'JUMP_TO_MESSAGE') {
        jumpToMessage(message.message);
    }
});

// Detect text selection
document.addEventListener('mouseup', (e) => {
    if (!enabled) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text) {
        showIconButton(e.clientX, e.clientY, selection);
    } else {
        removeIconButton();
    }
});

// Show icon button near the selected text
function showIconButton(x, y, selection) {
    if (iconButton) return; // Avoid duplicate buttons

    iconButton = document.createElement('button');
    iconButton.textContent = 'Pin text 📌';
    iconButton.style.cssText = `
        position: fixed;
        left: ${x + 20}px;
        top: ${y - 40}px;
        background: #333;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 12px;
        z-index: 10000;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    `;

    iconButton.addEventListener('click', () => {
        pinSelectedText(selection);
        removeIconButton();
    });

    document.body.appendChild(iconButton);
}

// Remove the icon button
function removeIconButton() {
    if (iconButton) {
        iconButton.remove();
        iconButton = null;
    }
}

// Pin the selected text
function pinSelectedText(selection) {
    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement;

    const message = {
        text,
        position: getMessagePosition(container),
        timestamp: Date.now()
    };

    chrome.storage.sync.get(['pinnedMessages'], (data) => {
        const messages = data.pinnedMessages || [];
        if (!messages.some(m => m.text === message.text)) {
            messages.push(message);
            chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                showPinConfirmation();
            });
        }
    });
}

// Jump to the pinned message
function jumpToMessage(message) {
    const allMessages = document.querySelectorAll('.group');
    let targetMessage = null;

    // Find the message by its text content
    allMessages.forEach((msg) => {
        if (msg.textContent.includes(message.text)) {
            targetMessage = msg;
        }
    });

    if (targetMessage) {
        targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashElement(targetMessage);
    } else {
        console.warn('Message not found:', message.text);
    }
}

// Flash the element to highlight it
function flashElement(element) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background-color: rgba(33, 150, 243, 0.2);
        border-radius: 4px;
        pointer-events: none;
    `;

    element.style.position = 'relative';
    element.appendChild(overlay);

    setTimeout(() => overlay.remove(), 1000);
}

// Show a confirmation toast
function showPinConfirmation() {
    const toast = document.createElement('div');
    toast.textContent = '📌 Message pinned!';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Get the position of the message in the DOM (optional)
function getMessagePosition(element) {
    const messageContainer = element.closest('.group');
    if (!messageContainer) return null;

    const allMessages = Array.from(document.querySelectorAll('.group'));
    return allMessages.indexOf(messageContainer);
}

// Load initial state
chrome.storage.sync.get(['enabled'], (data) => {
    enabled = data.enabled || false;
});