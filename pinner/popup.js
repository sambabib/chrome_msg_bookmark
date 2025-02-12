document.addEventListener("DOMContentLoaded", () => {
    const pinMessageButton = document.getElementById("pinMessage");
    const clearMessagesButton = document.getElementById("clearMessages");
    const pinnedMessagesList = document.getElementById("pinnedMessages");

    // Function to add pinned message to UI
    function displayPinnedMessages(messages = []) {
        // Clear existing messages
        pinnedMessagesList.innerHTML = "";

        // Add each message
        messages.forEach((msg, index) => {
            // Create list item
            const li = document.createElement("li");

            // Create and style message span
            const messageSpan = document.createElement("span");
            messageSpan.textContent = msg;
            messageSpan.style.marginRight = "8px";
            li.appendChild(messageSpan);

            // Create delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "❌";
            deleteBtn.addEventListener("click", () => deletePinnedMessage(index));
            li.appendChild(deleteBtn);

            // Add to list
            pinnedMessagesList.appendChild(li);
        });
    }

    // Load initial messages
    function loadMessages() {
        chrome.storage.sync.get("pinnedMessages", (data) => {
            const messages = data.pinnedMessages || [];
            displayPinnedMessages(messages);
        });
    }

    // Initial load
    loadMessages();

    // Pin the selected message
    pinMessageButton.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    function: getSelectedText
                },
                (result) => {
                    if (result?.[0]?.result) {
                        const newMessage = result[0].result;

                        chrome.storage.sync.get("pinnedMessages", (data) => {
                            const messages = data.pinnedMessages || [];
                            if (!messages.includes(newMessage)) {
                                messages.push(newMessage);
                                chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                                    displayPinnedMessages(messages);
                                });
                            }
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
            const messages = data.pinnedMessages || [];
            messages.splice(index, 1);
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