document.addEventListener("DOMContentLoaded", () => {
    let list = document.getElementById("pinnedMessages");

    function loadMessages() {
        chrome.storage.sync.get({ pinnedMessages: [] }, (data) => {
            list.innerHTML = "";
            data.pinnedMessages.forEach((msg, index) => {
                let li = document.createElement("li");
                li.innerText = msg.text.substring(0, 50) + "...";
                li.title = msg.text;

                // Add a delete button
                let deleteButton = document.createElement("button");
                deleteButton.innerText = "❌";
                deleteButton.style.cssText = "margin-left: 10px; cursor: pointer; border: none; background: transparent; font-size: 12px;";
                deleteButton.addEventListener("click", () => deleteMessage(index));

                // Scroll to message on click
                li.addEventListener("click", () => {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            function: scrollToMessage,
                            args: [msg.text]
                        });
                    });
                });

                li.appendChild(deleteButton);
                list.appendChild(li);
            });
        });
    }

    function deleteMessage(index) {
        chrome.storage.sync.get({ pinnedMessages: [] }, (data) => {
            let messages = data.pinnedMessages;
            messages.splice(index, 1); // Remove the selected message
            chrome.storage.sync.set({ pinnedMessages: messages }, loadMessages);
        });
    }

    function scrollToMessage(messageText) {
        let messages = document.querySelectorAll(".group");
        for (let msg of messages) {
            if (msg.innerText.includes(messageText)) {
                msg.scrollIntoView({ behavior: "smooth", block: "center" });
                msg.style.backgroundColor = "#ffff99";
                setTimeout(() => (msg.style.backgroundColor = ""), 2000);
                break;
            }
        }
    }

    loadMessages();
});
