// content.js
let enabled = false;

document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        pinSelectedText();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_STATE') {
        enabled = message.enabled;
    } else if (message.type === 'JUMP_TO_MESSAGE') {
        jumpToMessage(message.message);
    }
});

function pinSelectedText() {
    const selection = window.getSelection();
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

function getMessagePosition(element) {
    const messageContainer = element.closest('.group');
    if (!messageContainer) return null;

    const allMessages = Array.from(document.querySelectorAll('.group'));
    return allMessages.indexOf(messageContainer);
}

function jumpToMessage(message) {
    const allMessages = document.querySelectorAll('.group');
    const targetMessage = allMessages[message.position];
    
    if (targetMessage) {
        targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashElement(targetMessage);
    }
}

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
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

chrome.storage.sync.get(['enabled'], (data) => {
    enabled = data.enabled || false;
});