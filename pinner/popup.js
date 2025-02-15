document.addEventListener('DOMContentLoaded', () => {
    const enableToggle = document.getElementById('enableToggle');
    const pinnedMessagesContainer = document.getElementById('pinnedMessages');
    const clearButton = document.getElementById('clearMessages');

    // Load initial state
    chrome.storage.sync.get(['enabled', 'pinnedMessages'], (data) => {
        console.log('Retrieved data:', data); // Debugging line
        enableToggle.checked = data.enabled || false;
        displayPinnedMessages(data.pinnedMessages || []);
    });

    // Toggle extension state
    enableToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ enabled: enableToggle.checked }, () => {
            // Notify content script of state change
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    type: 'TOGGLE_STATE', 
                    enabled: enableToggle.checked 
                });
            });
        });
    });

    // Clear all messages
    clearButton.addEventListener('click', () => {
        chrome.storage.sync.remove('pinnedMessages', () => {
            displayPinnedMessages([]);
        });
    });

    function displayPinnedMessages(messages) {
        pinnedMessagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            pinnedMessagesContainer.innerHTML = '<p>No pinned messages yet. Select text in ChatGPT and use Ctrl+Shift+P to pin.</p>';
            return;
        }

        messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'pinned-message';

            const textSpan = document.createElement('span');
            textSpan.className = 'message-text';
            textSpan.title = msg.text;
            textSpan.textContent = msg.text.length > 50 
                ? msg.text.substring(0, 50) + '...' 
                : msg.text;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';

            const jumpButton = document.createElement('button');
            jumpButton.textContent = '↗️';
            jumpButton.title = 'Jump to message';
            jumpButton.onclick = () => jumpToMessage(msg);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '🗑️';
            deleteButton.title = 'Delete pin';
            deleteButton.onclick = () => deleteMessage(index);

            actionsDiv.appendChild(jumpButton);
            actionsDiv.appendChild(deleteButton);
            messageDiv.appendChild(textSpan);
            messageDiv.appendChild(actionsDiv);
            pinnedMessagesContainer.appendChild(messageDiv);
        });
    }

    function jumpToMessage(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'JUMP_TO_MESSAGE',
                message: message
            });
        });
    }

    function deleteMessage(index) {
        chrome.storage.sync.get(['pinnedMessages'], (data) => {
            const messages = data.pinnedMessages || [];
            messages.splice(index, 1);
            chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                displayPinnedMessages(messages);
            });
        });
    }
});