document.addEventListener('DOMContentLoaded', () => {
    const enableToggle = document.getElementById('enableToggle');
    const pinnedMessagesContainer = document.getElementById('pinnedMessages');
    const clearButton = document.getElementById('clearMessages');
    
    // Load initial state
    chrome.storage.sync.get(['enabled', 'pinnedMessages'], (data) => {
        console.log('Retrieved data:', data);
        enableToggle.checked = data.enabled || false;
        loadPinnedMessages();
    });
    
    // Toggle extension state
    enableToggle.addEventListener('change', () => {
        const newState = enableToggle.checked;
        chrome.storage.sync.set({ enabled: newState }, () => {
            // Notify content script of state change
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        type: 'TOGGLE_STATE', 
                        enabled: newState 
                    }, (response) => {
                        console.log('Content script response:', response || 'No response');
                    });
                } else {
                    console.warn('No active tab found');
                }
            });
        });
        console.log("toggle_state", newState);
    });
    
    // Load pinned messages
    function loadPinnedMessages() {
        chrome.runtime.sendMessage({ action: "getPinnedMessages" }, (response) => {
            displayPinnedMessages(response.pinnedMessages || []);
        });
    }
    
    // Clear all messages
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all pinned messages?')) {
            chrome.runtime.sendMessage({ action: "clearPinnedMessages" }, (response) => {
                if (response && response.success) {
                    loadPinnedMessages();
                }
            });
        }
    });
    
    function displayPinnedMessages(messages) {
        pinnedMessagesContainer.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            pinnedMessagesContainer.innerHTML = '<div class="no-messages">No pinned messages yet. Select text in ChatGPT or Claude to pin it.</div>';
            return;
        }
        
        messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'pinned-message';
            
            // Determine which platform this message is from
            const platform = msg.platform || 'unknown';
            const platformIcon = platform === 'chatgpt' ? '🤖' : (platform === 'claude' ? '🧠' : '💬');
            
            const textSpan = document.createElement('span');
            textSpan.className = 'message-text';
            textSpan.title = msg.text;
            textSpan.textContent = (platformIcon + ' ' + msg.text).substring(0, 65) + 
                (msg.text.length > 65 ? '...' : '');
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            
            const jumpButton = document.createElement('button');
            jumpButton.className = 'action-button';
            jumpButton.textContent = '↗️';
            jumpButton.title = 'Jump to message';
            jumpButton.onclick = () => jumpToMessage(msg);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'action-button';
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
    
    function jumpToMessage(bookmark) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'JUMP_TO_MESSAGE',
                    bookmark: bookmark
                }, (response) => {
                    console.log('Jump response:', response || 'No response');
                    window.close(); // Close popup after jumping
                });
            } else {
                alert('No active tab found. Please make sure you are on a chat page.');
            }
        });
    }
    
    function deleteMessage(index) {
        chrome.runtime.sendMessage({ 
            action: "deletePinnedMessage", 
            index: index 
        }, (response) => {
            if (response && response.success) {
                displayPinnedMessages(response.messages || []);
            }
        });
    }
});