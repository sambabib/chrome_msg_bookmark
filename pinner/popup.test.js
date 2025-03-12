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
        },
        {
            text: "Test message from Grok",
            xpath: "//div[@class='message-content']/p[1]",
            selector: ".message-content p",
            textContext: "Grok AI assistant response",
            timestamp: Date.now() - 5000,
            platform: "grok",
            url: "https://grok.x.ai/chat"
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // Create a fresh DOM for each test
        document.body.innerHTML = `
            <h1>Chat Message Pinner</h1>
            <div class="toggle-container">
                <label for="enableToggle">Enable</label>
                <input type="checkbox" id="enableToggle">
            </div>
            <div class="messages-container" id="pinnedMessages"></div>
            <button id="clearMessages" class="clear-button">Clear All Messages</button>
            <div class="how-to">Select text in ChatGPT, Claude, or Grok to pin it. Click ↗️ to jump to a pinned message.</div>
        `;

        // Mock Chrome APIs
        global.chrome = {
            storage: {
                sync: {
                    get: jest.fn((keys, callback) => {
                        if (Array.isArray(keys) && (keys.includes('enabled') || keys.includes('pinnedMessages'))) {
                            callback({ enabled: true, pinnedMessages: mockMessages });
                        } else if (keys === 'enabled') {
                            callback({ enabled: true });
                        } else if (keys === 'pinnedMessages') {
                            callback({ pinnedMessages: mockMessages });
                        } else {
                            callback({});
                        }
                    }),
                    set: jest.fn((data, callback) => callback && callback())
                }
            },
            tabs: {
                query: jest.fn((queryInfo, callback) => callback([{ id: 1 }])),
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
                })
            }
        };

        // Mock window.close
        global.window.close = jest.fn();

        // Mock alert and confirm
        global.alert = jest.fn();
        global.confirm = jest.fn(() => true);

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

        // Check if messages are displayed
        const messagesContainer = document.getElementById("pinnedMessages");
        expect(messagesContainer.textContent).toContain("Test message from ChatGPT");
        expect(messagesContainer.textContent).toContain("Test message from Claude");
        expect(messagesContainer.textContent).toContain("Test message from Grok");
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
        expect(chrome.tabs.sendMessage).toHaveBeenCalled();
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
        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Click the clear all button
        const clearButton = document.getElementById("clearMessages");
        fireEvent.click(clearButton);

        // Check if runtime.sendMessage was called to clear all messages
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
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

        // Check if the no messages text is displayed
        const messagesContainer = document.getElementById("pinnedMessages");
        expect(messagesContainer.textContent).toContain("No pinned messages yet");
    });

    test("should toggle extension state when toggle is clicked", async () => {
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Get the toggle element
        const enableToggle = document.getElementById("enableToggle");
        
        // Change the toggle state
        enableToggle.checked = false;
        fireEvent.change(enableToggle);

        // Check if storage was updated
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            { enabled: false },
            expect.any(Function)
        );
    });
});