/**
 * @jest-environment jsdom
 */

const { fireEvent, screen } = require("@testing-library/dom");
require("@testing-library/jest-dom");

describe("ChatGPT Pinner Extension", () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Set up chrome mock
        global.chrome = {
            storage: {
                sync: {
                    get: jest.fn((keys, callback) => callback({ pinnedMessages: [] })),
                    set: jest.fn((data, callback) => callback && callback()),
                    remove: jest.fn((key, callback) => callback && callback()),
                },
            },
            scripting: {
                executeScript: jest.fn((details, callback) => callback([{ result: "Mocked Selected Text" }])),
            },
            tabs: {
                query: jest.fn((_, callback) => callback([{ id: 1, url: "https://chat.openai.com" }])),
            },
        };

        // Set up the DOM
        document.body.innerHTML = `
            <button id="pinMessage">Pin Selected Message</button>
            <button id="clearMessages">Clear All</button>
            <ul id="pinnedMessages"></ul>
        `;

        // Reset modules before importing popup.js
        jest.resetModules();
    });

    const loadPopupScript = () => {
        require("../popup.js");
        document.dispatchEvent(new Event('DOMContentLoaded'));
    };

    test("should save and display a pinned message", async () => {
        loadPopupScript();

        const pinButton = screen.getByText("Pin Selected Message");
        fireEvent.click(pinButton);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            { pinnedMessages: ["Mocked Selected Text"] },
            expect.any(Function)
        );
    });

    test("should retrieve and display pinned messages on load", async () => {
        // Mock storage with initial messages
        const mockMessages = ["Saved Message 1", "Saved Message 2"];
        chrome.storage.sync.get = jest.fn((key, callback) => 
            callback({ pinnedMessages: mockMessages })
        );

        // Load popup and wait for async operations
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        // Check content
        const pinnedMessagesList = document.getElementById("pinnedMessages");
        expect(pinnedMessagesList.textContent).toContain("Saved Message 1");
        expect(pinnedMessagesList.textContent).toContain("Saved Message 2");
    });

    test("should delete a pinned message", async () => {
        const initialMessages = ["Message 1", "Message 2"];
        chrome.storage.sync.get = jest.fn((key, callback) => 
            callback({ pinnedMessages: initialMessages })
        );

        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        const deleteButtons = document.querySelectorAll("ul button");
        fireEvent.click(deleteButtons[0]);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            { pinnedMessages: ["Message 2"] },
            expect.any(Function)
        );
    });

    test("should clear all pinned messages", async () => {
        const initialMessages = ["Message 1", "Message 2"];
        chrome.storage.sync.get = jest.fn((key, callback) => 
            callback({ pinnedMessages: initialMessages })
        );

        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        const clearButton = screen.getByText("Clear All");
        fireEvent.click(clearButton);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.sync.remove).toHaveBeenCalledWith(
            "pinnedMessages",
            expect.any(Function)
        );
    });
});