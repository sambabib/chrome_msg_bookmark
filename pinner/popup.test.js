/**
 * @jest-environment jsdom
 */

const { fireEvent, screen } = require("@testing-library/dom");
require("@testing-library/jest-dom");

describe("ChatGPT Pinner Extension", () => {
    beforeEach(() => {
        jest.clearAllMocks();

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
                sendMessage: jest.fn()
            },
            runtime: {
                sendMessage: jest.fn(),
                onMessage: {
                    addListener: jest.fn()
                }
            }
        };

        document.body.innerHTML = `
            <input type="checkbox" id="enableToggle">
            <button id="pinMessage">Pin Selected Message</button>
            <button id="clearMessages">Clear All</button>
            <ul id="pinnedMessages"></ul>
        `;

        jest.resetModules();
    });

    const loadPopupScript = () => {
        require("./popup.js");
        document.dispatchEvent(new Event('DOMContentLoaded'));
    };

    test("should load initial state correctly", async () => {
        loadPopupScript();
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(chrome.storage.sync.get).toHaveBeenCalledWith(
            ['enabled', 'pinnedMessages'],
            expect.any(Function)
        );
    });

    test("should toggle extension state", async () => {
        loadPopupScript();
        
        const toggle = document.getElementById('enableToggle');
        fireEvent.change(toggle, { target: { checked: true } });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            { enabled: true },
            expect.any(Function)
        );
        expect(chrome.tabs.query).toHaveBeenCalledWith(
            { active: true, currentWindow: true },
            expect.any(Function)
        );
    });

    test("should retrieve and display pinned messages on load", async () => {
        const mockMessages = [
            { text: "Saved Message 1", position: 0, timestamp: Date.now() },
            { text: "Saved Message 2", position: 1, timestamp: Date.now() }
        ];
        
        chrome.storage.sync.get = jest.fn((key, callback) => 
            callback({ pinnedMessages: mockMessages })
        );

        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));

        const pinnedMessagesList = document.getElementById("pinnedMessages");
        expect(pinnedMessagesList.textContent).toContain("Saved Message 1");
        expect(pinnedMessagesList.textContent).toContain("Saved Message 2");
    });

    test("should delete a pinned message", async () => {
        const initialMessages = [
            { text: "Message 1", position: 0, timestamp: Date.now() },
            { text: "Message 2", position: 1, timestamp: Date.now() }
        ];
        
        chrome.storage.sync.get = jest.fn((key, callback) => 
            callback({ pinnedMessages: initialMessages })
        );
    
        loadPopupScript();
        await new Promise(resolve => setTimeout(resolve, 0));
    
        const deleteButtons = document.querySelectorAll(".actions button:last-child");
        fireEvent.click(deleteButtons[0]);
    
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            {
                pinnedMessages: [
                    {
                        text: "Message 2",
                        position: 1,
                        timestamp: expect.any(Number)
                    }
                ]
            },
            expect.any(Function)
        );
    });

    test("should clear all pinned messages", async () => {
        const initialMessages = [
            { text: "Message 1", position: 0, timestamp: Date.now() },
            { text: "Message 2", position: 1, timestamp: Date.now() }
        ];
        
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