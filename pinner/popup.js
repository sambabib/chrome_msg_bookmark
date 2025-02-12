document.addEventListener("DOMContentLoaded", () => {
    const pinMessageButton = document.getElementById("pinMessage");
    const clearMessagesButton = document.getElementById("clearMessages");
    const pinnedMessagesList = document.getElementById("pinnedMessages");

    // Function to add pinned message to UI
    function displayPinnedMessages(messages) {
        pinnedMessagesList.innerHTML = "";
        messages.forEach((msg, index) => {
            const li = document.createElement("li");
            li.textContent = msg;
            
            // Add delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "❌";
            deleteBtn.addEventListener("click", () => deletePinnedMessage(index));
            li.appendChild(deleteBtn);
            
            pinnedMessagesList.appendChild(li);
        });
    }

    // Fetch pinned messages when popup opens
    chrome.storage.sync.get("pinnedMessages", (data) => {
        const messages = data.pinnedMessages || [];
        displayPinnedMessages(messages);
    });

    // Pin the selected message
    pinMessageButton.addEventListener("click", () => {
        // Get the selected text from the ChatGPT page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    function: getSelectedText
                },
                (result) => {
                    if (result && result[0] && result[0].result) {
                        let newMessage = result[0].result;
                        
                        // Save to storage
                        chrome.storage.sync.get("pinnedMessages", (data) => {
                            let messages = data.pinnedMessages || [];
                            messages.push(newMessage);
                            chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                                displayPinnedMessages(messages);
                            });
                        });
                    }
                }
            );
        });
    });

    // Clear all pinned messages
    clearMessagesButton.addEventListener("click", () => {
        chrome.storage.sync.remove("pinnedMessages", () => {
            displayPinnedMessages([]);
        });
    });

    // Delete a single pinned message
    function deletePinnedMessage(index) {
        chrome.storage.sync.get("pinnedMessages", (data) => {
            let messages = data.pinnedMessages || [];
            messages.splice(index, 1); // Remove message at index
            chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                displayPinnedMessages(messages);
            });
        });
    }
});

// Function to get selected text on the page
function getSelectedText() {
    return window.getSelection().toString();
}
