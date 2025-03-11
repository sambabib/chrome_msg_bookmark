/**
 * @jest-environment jsdom
 */

const { fireEvent } = require("@testing-library/dom");
require("@testing-library/jest-dom");

describe("Chat Message Pinner Extension", () => {
    // Mock data for testing
    const mockMessages = [
        {
            text: "Test message from ChatGPT",
            xpath: "//div[@class='markdown']/p[1]",
            selector: ".markdown p",
            textContext: "This is some context around the test message",
            timestamp: Date.now() - 10000,
            platform: "chatgpt",
            url: "https://chatgpt.com/chat"
        },
        {
            text: "Test message from Claude",
            xpath: "//div[@class='prose']/p[2]",
            selector: ".prose p",
            textContext: "Claude AI assistant helpful response",
            timestamp: Date.now(),
            platform: "claude",
            url: "https://claude.ai/chat"
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // Create a fresh DOM for each test
        document.body.innerHTML = `
            <h1>Chat Message Pinner</h1>
            <div class="messages-container" id="pinnedMessages"></div>
            <button id="clearMessages" class="clear-button">Clear All Messages</button>
            <div class="how-to">Select text in ChatGPT or Claude to pin it. Click ↗️ to jump to a pinned message.</div>
        `;

        // Mock Chrome APIs
        global.chrome = {
            storage: {
                sync: {
                    get: jest.fn((key, callback) => {
                        if (key === "pinnedMessages" || (Array.isArray(key) && key.includes("pinnedMessages"))) {
                            callback({ pinnedMessages: [] });
                        } else {
                            callback({});
                        }
                    }),
                    set: jest.fn((data, callback) => callback && callback()),
                    remove: jest.fn((key, callback) => callback && callback()),
                }
            },
            tabs: {
                query: jest.fn((_, callback) => callback([{ id: 1 }])),
                sendMessage: jest.fn()
            },
            runtime: {
                sendMessage: jest.fn((message, callback) => {
                    if (message.action === "getPinnedMessages") {
                        callback({ pinnedMessages: mockMessages });
                    } else if (message.action === "clearPinnedMessages") {
                        callback({ success: true });
                    } else if (message.action === "deletePinnedMessage") {
                        const newMessages = [...mockMessages];
                        newMessages.splice(message.index, 1);
                        callback({ success: true, messages: newMessages });
                    }
                }),
                onMessage: { addListener: jest.fn() }
            }
        };

        // Reset modules before loading popup.js
        jest.resetModules();
    });

    function loadPopupScript() {
        require("./popup.js");
        document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    test("should load and display pinned messages on initialization", async () => {
        loadPopupScript();

        // Allow time for async operations
        await new Promise(resolve => setTimeout(resolve, 0));

        // Check if runtime.sendMessage was called to get pinned messages
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            { action: "getPinnedMessages" },
            expect.any(Function)
        );

        // Check if messages are displayed
        const messagesContainer = document.getElementById("pinnedMessages");
        expect(messagesContainer.textContent).toContain("Test message from ChatGPT");
        expect(messagesContainer.textContent).toContain("Test message from Claude");

        // Check if platform icons are displayed
        expect(messagesContainer.innerHTML).toContain("🤖"); // ChatGPT icon
        expect(messagesContainer.innerHTML).toContain("🧠"); // Claude icon
    });

    test("should jump to a message when jump button is clicked", async () => {
        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Find jump buttons
        const jumpButtons = document.querySelectorAll(".action-button");
        const firstJumpButton = Array.from(jumpButtons).find(btn => btn.textContent === "↗️");

        // Click the jump button for the first message
        fireEvent.click(firstJumpButton);

        // Check if sendMessage was called to jump to the message
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            1, // tab id
            {
                type: "JUMP_TO_MESSAGE",
                bookmark: mockMessages[0]
            },
            expect.any(Function)
        );
    });

    test("should delete a message when delete button is clicked", async () => {
        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Find all delete buttons and click the first one
        const deleteButtons = Array.from(document.querySelectorAll(".action-button"))
            .filter(btn => btn.textContent === "🗑️");

        fireEvent.click(deleteButtons[0]);

        // Check if runtime.sendMessage was called to delete the message
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            {
                action: "deletePinnedMessage",
                index: 0
            },
            expect.any(Function)
        );
    });

    test("should clear all messages when clear button is clicked", async () => {
        // Mock the confirm dialog to return true
        global.confirm = jest.fn(() => true);

        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Click the clear all button
        const clearButton = document.getElementById("clearMessages");
        fireEvent.click(clearButton);

        // Check if confirm was called
        expect(confirm).toHaveBeenCalledWith('Are you sure you want to clear all pinned messages?');

        // Check if runtime.sendMessage was called to clear all messages
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            { action: "clearPinnedMessages" },
            expect.any(Function)
        );
    });

    test("should not clear messages if user cancels the confirmation", async () => {
        // Mock the confirm dialog to return false
        global.confirm = jest.fn(() => false);

        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Click the clear all button
        const clearButton = document.getElementById("clearMessages");
        fireEvent.click(clearButton);

        // Check if confirm was called
        expect(confirm).toHaveBeenCalled();

        // Check that runtime.sendMessage was NOT called to clear messages
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
            { action: "clearPinnedMessages" },
            expect.any(Function)
        );
    });

    test("should show a message when no pins exist", async () => {
        // Override the mock to return empty message list
        chrome.runtime.sendMessage = jest.fn((message, callback) => {
            if (message.action === "getPinnedMessages") {
                callback({ pinnedMessages: [] });
            }
        });

        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Check for the "no messages" text
        const messagesContainer = document.getElementById("pinnedMessages");
        expect(messagesContainer.textContent).toContain("No pinned messages yet");
    });

    test("should truncate long message text in the display", async () => {
        // Message with very long text
        const longMessage = {
            text: "This is a very long message that should be truncated when displayed in the popup. It contains a lot of text that wouldn't fit in the UI without scrolling or breaking the layout.",
            platform: "chatgpt",
            timestamp: Date.now()
        };

        chrome.runtime.sendMessage = jest.fn((message, callback) => {
            if (message.action === "getPinnedMessages") {
                callback({ pinnedMessages: [longMessage] });
            }
        });

        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Check if the text was truncated with ellipsis
        const messageElement = document.querySelector(".message-text");
        expect(messageElement.textContent.length).toBeLessThan(longMessage.text.length);
        expect(messageElement.textContent).toContain("...");
    });
});