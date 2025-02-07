function addPinButtons() {
    document.querySelectorAll(".group").forEach((msg) => {
        if (msg.querySelector(".pin-btn")) return;

        let pinButton = document.createElement("button");
        pinButton.innerText = "📌 Pin";
        pinButton.className = "pin-btn";
        pinButton.style.cssText = "margin-left: 10px; cursor: pointer; border: none; background: transparent; font-size: 14px;";

        pinButton.addEventListener("click", () => {
            let messageText = msg.innerText;
            chrome.storage.sync.get({ pinnedMessages: [] }, (data) => {
                let messages = data.pinnedMessages;

                if (!messages.some(m => m.text === messageText)) {
                    messages.push({ text: messageText, timestamp: Date.now() });
                    chrome.storage.sync.set({ pinnedMessages: messages });
                }
            });
        });

        msg.appendChild(pinButton);
    });
}

// Observe new messages
const observer = new MutationObserver(() => addPinButtons());
observer.observe(document.body, { childList: true, subtree: true });

// Run on page load
addPinButtons();
