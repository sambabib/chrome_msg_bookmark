document.addEventListener('DOMContentLoaded', () => {
    const enableToggle = document.getElementById('enableToggle');
    const pinnedMessagesContainer = document.getElementById('pinnedMessages');
    const clearButton = document.getElementById('clearMessages');
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsContainer = document.getElementById('settingsContainer');
    const maxPinsInput = document.getElementById('maxPins');
    const saveSettingsButton = document.getElementById('saveSettings');
    const settingsStatus = document.getElementById('settingsStatus');
    
    // Ensure toast container exists
    if (!document.getElementById('pinnerToastContainer')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'pinnerToastContainer';
        toastContainer.className = 'pinner-toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Load initial state
    chrome.storage.sync.get(['enabled', 'pinnedMessages', 'maxPins'], (data) => {
        console.log('Retrieved data:', data);
        enableToggle.checked = data.enabled || false;
        
        // Load settings values
        maxPinsInput.value = data.maxPins || 50;
        
        // Directly use the pinnedMessages from storage instead of requesting from background
        displayPinnedMessages(data.pinnedMessages || []);
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
            
            // Show toast notification
            if (window.pinnerToast) {
                if (newState) {
                    window.pinnerToast.success('Extension enabled');
                } else {
                    window.pinnerToast.info('Extension disabled');
                }
            }
        });
        console.log("toggle_state", newState);
    });
    
    // Toggle settings visibility
    settingsToggle.addEventListener('click', () => {
        settingsContainer.classList.toggle('visible');
        settingsToggle.textContent = settingsContainer.classList.contains('visible') 
            ? '⚙️ Hide Settings' 
            : '⚙️ Settings';
    });
    
    // Save settings
    saveSettingsButton.addEventListener('click', () => {
        const maxPins = parseInt(maxPinsInput.value) || 50;
        
        // Validate maxPins
        if (maxPins < 5 || maxPins > 100) {
            if (window.pinnerToast) {
                window.pinnerToast.error('Max pins must be between 5 and 100');
            } else {
                alert('Max pins must be between 5 and 100');
            }
            return;
        }
        
        // Save settings
        chrome.storage.sync.set({ 
            maxPins: maxPins
        }, () => {
            if (window.pinnerToast) {
                window.pinnerToast.success('Settings saved successfully!');
            } else if (settingsStatus) {
                settingsStatus.textContent = 'Settings saved!';
                settingsStatus.style.color = '#4CAF50';
                
                // Clear status message after 3 seconds
                setTimeout(() => {
                    settingsStatus.textContent = '';
                }, 3000);
            }
        });
    });
    
    // Load pinned messages directly from storage
    function loadPinnedMessages() {
        chrome.storage.sync.get(['pinnedMessages'], (data) => {
            displayPinnedMessages(data.pinnedMessages || []);
        });
    }
    
    // Clear all messages
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all pinned messages?')) {
            chrome.storage.sync.remove('pinnedMessages', () => {
                displayPinnedMessages([]);
                
                if (window.pinnerToast) {
                    window.pinnerToast.info('All pins have been cleared');
                }
                
                // Notify content script to refresh pins
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.tabs.sendMessage(tabs[0].id, { 
                            type: 'REFRESH_PINS'
                        });
                    }
                });
            });
        }
    });
    
    function displayPinnedMessages(messages) {
        pinnedMessagesContainer.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            pinnedMessagesContainer.innerHTML = '<div class="no-messages">No pinned messages yet. Select text in ChatGPT, Claude, or Grok to pin it.</div>';
            return;
        }
        
        // Sort messages by timestamp (newest first)
        messages.sort((a, b) => b.timestamp - a.timestamp);
        
        messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'pinned-message';
            
            // Determine which platform this message is from
            const platform = msg.platform || 'unknown';
            let platformIcon = '💬'; // Default
            
            if (platform === 'chatgpt') {
                platformIcon = '🤖';
                messageDiv.classList.add('platform-chatgpt');
            } else if (platform === 'claude') {
                platformIcon = '🧠';
                messageDiv.classList.add('platform-claude');
            } else if (platform === 'grok') {
                platformIcon = '🔍';
                messageDiv.classList.add('platform-grok');
            }
            
            // Add timestamp display
            const date = new Date(msg.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            const textSpan = document.createElement('span');
            textSpan.className = 'message-text';
            textSpan.title = `${msg.text}\n\nPinned on: ${formattedDate}`;
            
            // Truncate text for display
            const displayText = msg.text.length > 65 
                ? msg.text.substring(0, 65) + '...' 
                : msg.text;
                
            textSpan.textContent = platformIcon + ' ' + displayText;
            
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
                    
                    if (window.pinnerToast) {
                        window.pinnerToast.info('Jumping to message...');
                    }
                    
                    window.close(); // Close popup after jumping
                });
            } else {
                if (window.pinnerToast) {
                    window.pinnerToast.error('No active tab found. Please make sure you are on a chat page.');
                } else {
                    alert('No active tab found. Please make sure you are on a chat page.');
                }
            }
        });
    }
    
    function deleteMessage(index) {
        chrome.storage.sync.get(['pinnedMessages'], (data) => {
            const messages = data.pinnedMessages || [];
            if (index >= 0 && index < messages.length) {
                messages.splice(index, 1);
                
                chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                    displayPinnedMessages(messages);
                    
                    if (window.pinnerToast) {
                        window.pinnerToast.success('Pin deleted successfully');
                    }
                    
                    // Notify content script to refresh pins
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0] && tabs[0].id) {
                            chrome.tabs.sendMessage(tabs[0].id, { 
                                type: 'REFRESH_PINS'
                            });
                        }
                    });
                });
            }
        });
    }
    
    // Refresh the pinned messages every time the popup is opened
    loadPinnedMessages();
});