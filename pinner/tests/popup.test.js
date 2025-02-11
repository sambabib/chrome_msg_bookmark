const { JSDOM } = require("jsdom");

global.chrome = {
  storage: {
    sync: {
      get: jest.fn((key, callback) => callback({ pinnedMessages: [] })),
      set: jest.fn(),
    },
  },
};

describe("Popup Script Tests", () => {
  let document, loadMessages, deleteMessage;

  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <ul id="pinnedMessages"></ul>
        </body>
      </html>
    `);
    document = dom.window.document;
    global.document = document;

    // Load the script
    const popupScript = require("../popup");
    loadMessages = popupScript.loadMessages;
    deleteMessage = popupScript.deleteMessage;
  });

  test("Loads messages from storage", () => {
    chrome.storage.sync.get.mockImplementation((key, callback) => {
      callback({ pinnedMessages: [{ text: "Test Message", timestamp: 123 }] });
    });

    loadMessages();

    const items = document.querySelectorAll("li");
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("Test Message");
  });

  test("Deletes message and updates storage", () => {
    chrome.storage.sync.get.mockImplementation((key, callback) => {
      callback({ pinnedMessages: [{ text: "Message 1" }, { text: "Message 2" }] });
    });

    deleteMessage(0);

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ pinnedMessages: [{ text: "Message 2" }] });
  });
});
