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

        // Create a fresh DOM for each test with updated HTML structure
        document.body.innerHTML = `
            <div class="header">
                <h1>Chat Message Pinner</h1>
                <div class="toggle-container">
                    <span class="toggle-label">Enable</span>
                    <label class="toggle">
                        <input type="checkbox" id="enableToggle">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div id="pinnedMessages"></div>
            <div class="actions-container">
                <button id="clearMessages">Clear All Pins</button>
                <button id="settingsToggle">⚙️ Settings</button>
            </div>
            <div id="settingsContainer" class="settings-container">
                <h2>Settings</h2>
                <div class="setting-item">
                    <label for="maxPins">Maximum Pins:</label>
                    <input type="number" id="maxPins" min="5" max="100" value="50">
                </div>
                <button id="saveSettings">Save Settings</button>
                <div id="settingsStatus" class="settings-status"></div>
            </div>
            <div id="pinnerToastContainer" class="pinner-toast-container"></div>
        `;

        // Mock Chrome API
        global.chrome = {
            storage: {
                sync: {
                    get: jest.fn((keys, callback) => {
                        if (typeof keys === 'string') {
                            // Handle single key
                            if (keys === 'enabled') {
                                callback({ enabled: true });
                            } else if (keys === 'pinnedMessages') {
                                callback({ pinnedMessages: mockMessages });
                            } else if (keys === 'maxPins') {
                                callback({ maxPins: 50 });
                            } else {
                                callback({});
                            }
                        } else if (Array.isArray(keys)) {
                            // Handle array of keys
                            const result = {};
                            if (keys.includes('enabled')) result.enabled = true;
                            if (keys.includes('pinnedMessages')) result.pinnedMessages = mockMessages;
                            if (keys.includes('maxPins')) result.maxPins = 50;
                            callback(result);
                        } else if (typeof keys === 'object') {
                            // Handle object with keys
                            const result = {};
                            if ('enabled' in keys) result.enabled = true;
                            if ('pinnedMessages' in keys) result.pinnedMessages = mockMessages;
                            if ('maxPins' in keys) result.maxPins = 50;
                            callback(result);
                        } else {
                            callback({});
                        }
                    }),
                    set: jest.fn((data, callback) => callback && callback()),
                    remove: jest.fn((key, callback) => callback && callback())
                }
            },
            tabs: {
                query: jest.fn((queryInfo, callback) => callback([{ id: 1 }])),
                sendMessage: jest.fn((tabId, message, callback) => {
                    if (callback) callback({ success: true });
                })
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

        // Reset modules before loading scripts
        jest.resetModules();

        // Create proper Jest mock functions for toast
        window.pinnerToast = {
            success: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            warning: jest.fn(),
            show: jest.fn()
        };

        // Mock toast.js initialization
        jest.mock('./toast.js', () => {
            // This mock just ensures the toast.js script doesn't overwrite our mock
            return {};
        }, { virtual: true });
    });

    function loadPopupScript() {
        // Load the script
        require('./popup.js');

        // Dispatch DOMContentLoaded event to trigger initialization
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

        // Check if toast notification was shown
        expect(window.pinnerToast.info).toHaveBeenCalledWith('Jumping to message...');
    });

    test("should delete a message when delete button is clicked", async () => {
        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Find all delete buttons and click the first one
        const deleteButtons = Array.from(document.querySelectorAll(".action-button"))
            .filter(btn => btn.textContent === "🗑️");

        fireEvent.click(deleteButtons[0]);

        // Check if storage was updated to delete the message
        expect(chrome.storage.sync.get).toHaveBeenCalledWith(
            ['pinnedMessages'],
            expect.any(Function)
        );

        // Check if toast notification was shown
        expect(window.pinnerToast.success).toHaveBeenCalledWith('Pin deleted successfully');
    });

    test("should clear all messages when clear button is clicked", async () => {
        loadPopupScript();

        await new Promise(resolve => setTimeout(resolve, 0));

        // Click the clear all button
        const clearButton = document.getElementById("clearMessages");
        fireEvent.click(clearButton);

        // Check if storage was cleared
        expect(chrome.storage.sync.remove).toHaveBeenCalledWith(
            'pinnedMessages',
            expect.any(Function)
        );

        // Check if toast notification was shown
        expect(window.pinnerToast.info).toHaveBeenCalledWith('All pins have been cleared');
    });

    test("should show a message when no pins exist", async () => {
        // Override the mock to return empty message list
        chrome.storage.sync.get = jest.fn((keys, callback) => {
            if (Array.isArray(keys) && keys.includes('pinnedMessages')) {
                callback({ pinnedMessages: [] });
            } else {
                callback({});
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

        // Check if toast notification was shown
        expect(window.pinnerToast.info).toHaveBeenCalledWith('Extension disabled');
    });

    // New tests for settings functionality
    test("should toggle settings visibility when settings button is clicked", async () => {
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Get the settings toggle button and container
        const settingsToggle = document.getElementById("settingsToggle");
        const settingsContainer = document.getElementById("settingsContainer");

        // Initially settings should be hidden
        expect(settingsContainer.classList.contains("visible")).toBe(false);

        // Click the settings toggle
        fireEvent.click(settingsToggle);

        // Settings should now be visible
        expect(settingsContainer.classList.contains("visible")).toBe(true);

        // Click again to hide
        fireEvent.click(settingsToggle);

        // Settings should be hidden again
        expect(settingsContainer.classList.contains("visible")).toBe(false);
    });

    test("should load settings values on initialization", async () => {
        // Mock specific settings values
        chrome.storage.sync.get = jest.fn((keys, callback) => {
            if (Array.isArray(keys)) {
                const result = {};
                if (keys.includes('enabled')) result.enabled = true;
                if (keys.includes('pinnedMessages')) result.pinnedMessages = mockMessages;
                if (keys.includes('maxPins')) result.maxPins = 75;
                callback(result);
            } else {
                callback({});
            }
        });

        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Check if settings inputs have the correct values
        const maxPinsInput = document.getElementById("maxPins");
        expect(maxPinsInput.value).toBe("75");
    });

    test("should save settings when save button is clicked", async () => {
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Get the settings inputs and save button
        const maxPinsInput = document.getElementById("maxPins");
        const saveButton = document.getElementById("saveSettings");

        // Change the settings values
        maxPinsInput.value = "80";

        // Click the save button
        fireEvent.click(saveButton);

        // Check if storage was updated with new settings
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            { maxPins: 80 },
            expect.any(Function)
        );

        // Check if toast notification was shown
        expect(window.pinnerToast.success).toHaveBeenCalledWith('Settings saved successfully!');
    });

    test("should validate settings input values", async () => {
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Get the settings inputs and save button
        const maxPinsInput = document.getElementById("maxPins");
        const saveButton = document.getElementById("saveSettings");

        // Test invalid max pins (too low)
        maxPinsInput.value = "3";
        fireEvent.click(saveButton);

        expect(window.pinnerToast.error).toHaveBeenCalledWith('Max pins must be between 5 and 100');
        expect(chrome.storage.sync.set).not.toHaveBeenCalled();

        // Reset mock
        window.pinnerToast.error.mockClear();
        chrome.storage.sync.set.mockClear();

        // Test invalid max pins (too high)
        maxPinsInput.value = "150";
        fireEvent.click(saveButton);

        expect(window.pinnerToast.error).toHaveBeenCalledWith('Max pins must be between 5 and 100');
        expect(chrome.storage.sync.set).not.toHaveBeenCalled();

        // Reset mock
        window.pinnerToast.error.mockClear();
        window.pinnerToast.success.mockClear();
        chrome.storage.sync.set.mockClear();

        // Test valid values
        maxPinsInput.value = "50";
        fireEvent.click(saveButton);

        expect(window.pinnerToast.success).toHaveBeenCalledWith('Settings saved successfully!');
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ maxPins: 50 }, expect.any(Function));
    });

    test("should fall back to alert when toast is not available", async () => {
        // Remove toast from window before loading popup script
        delete window.pinnerToast;

        // Load popup script without toast
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Try to save invalid settings
        const maxPinsInput = document.getElementById("maxPins");
        const saveButton = document.getElementById("saveSettings");

        maxPinsInput.value = "3";
        fireEvent.click(saveButton);

        // Should use alert as fallback
        expect(global.alert).toHaveBeenCalledWith('Max pins must be between 5 and 100');
    });

    test("should show appropriate toast types for different actions", async () => {
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Test success toast - saving valid settings
        const saveButton = document.getElementById("saveSettings");
        const maxPinsInput = document.getElementById("maxPins");

        maxPinsInput.value = "50";
        fireEvent.click(saveButton);
        expect(window.pinnerToast.success).toHaveBeenCalledWith('Settings saved successfully!');

        // Reset mock
        window.pinnerToast.success.mockClear();

        // Test info toast - clearing messages
        const clearButton = document.getElementById("clearMessages");
        fireEvent.click(clearButton);
        expect(window.pinnerToast.info).toHaveBeenCalledWith('All pins have been cleared');

        // Reset mock
        window.pinnerToast.info.mockClear();

        // Test error toast - invalid settings
        maxPinsInput.value = "3";
        fireEvent.click(saveButton);
        expect(window.pinnerToast.error).toHaveBeenCalledWith('Max pins must be between 5 and 100');

        // Test success toast - enabling extension
        const enableToggle = document.getElementById("enableToggle");
        enableToggle.checked = true;
        fireEvent.change(enableToggle);
        expect(window.pinnerToast.success).toHaveBeenCalledWith('Extension enabled');

        // Test info toast - disabling extension
        enableToggle.checked = false;
        fireEvent.change(enableToggle);
        expect(window.pinnerToast.info).toHaveBeenCalledWith('Extension disabled');
    });
});