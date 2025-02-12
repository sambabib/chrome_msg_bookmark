// Listen for storage changes to keep pins in sync
chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes.pinnedMessages) {
        addPinButtons();
    }
});

function addPinButtons() {
    document.querySelectorAll(".group").forEach((msg) => {
        // Skip if button already exists
        if (msg.querySelector(".pin-btn")) return;

        // Create pin button
        const pinButton = document.createElement("button");
        pinButton.innerText = "📌 Pin";
        pinButton.className = "pin-btn";
        pinButton.style.cssText = `
            margin-left: 10px;
            cursor: pointer;
            border: none;
            background: transparent;
            font-size: 14px;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        `;

        // Add hover effect
        pinButton.addEventListener("mouseover", () => {
            pinButton.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        });
        pinButton.addEventListener("mouseout", () => {
            pinButton.style.backgroundColor = "transparent";
        });

        // Handle pin click
        pinButton.addEventListener("click", () => {
            const messageText = msg.querySelector('.markdown').innerText || msg.innerText;
            
            chrome.storage.sync.get({ pinnedMessages: [] }, (data) => {
                const messages = data.pinnedMessages;
                
                // Check for duplicates
                if (!messages.some(m => m === messageText)) {
                    messages.push(messageText);
                    chrome.storage.sync.set({ pinnedMessages: messages }, () => {
                        // Visual feedback
                        pinButton.innerText = "📌 Pinned!";
                        setTimeout(() => {
                            pinButton.innerText = "📌 Pin";
                        }, 1500);
                    });
                } else {
                    // Show already pinned feedback
                    pinButton.innerText = "Already Pinned";
                    setTimeout(() => {
                        pinButton.innerText = "📌 Pin";
                    }, 1500);
                }
            });
        });

        // Find the best location to insert the button
        const targetLocation = msg.querySelector('.flex.justify-between') || msg;
        targetLocation.appendChild(pinButton);
    });
}

// Create and configure the observer
const observerConfig = {
    childList: true,
    subtree: true,
    attributes: false
};

// Callback function to handle mutations
const observerCallback = (mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            addPinButtons();
        }
    }
};

// Initialize the observer
const observer = new MutationObserver(observerCallback);

// Start observing with a slight delay to ensure DOM is ready
setTimeout(() => {
    observer.observe(document.body, observerConfig);
    addPinButtons(); // Initial run
}, 1000);