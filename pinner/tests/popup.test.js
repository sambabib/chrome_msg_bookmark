/**
 * @jest-environment jsdom
 */

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
      query: jest.fn((queryInfo, callback) => callback([{ id: 1 }])),
  },
};

document.body.innerHTML = `
  <button id="pinMessage">Pin Selected Message</button>
  <button id="clearMessages">Clear All</button>
  <ul id="pinnedMessages"></ul>
`;

require("../popup.js");

describe("ChatGPT Pinner Extension", () => {
  beforeEach(() => {
      jest.clearAllMocks();
  });

  test("should save and display a pinned message", () => {
      const pinButton = document.getElementById("pinMessage");
      pinButton.click(); 

      expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
      expect(chrome.storage.sync.get).toHaveBeenCalled();
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
          { pinnedMessages: ["Mocked Selected Text"] },
          expect.any(Function)
      );
  });

  test("should retrieve and display pinned messages on load", () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) =>
          callback({ pinnedMessages: ["Saved Message"] })
      );

      require("../popup.js");

      const pinnedMessagesList = document.getElementById("pinnedMessages");
      expect(pinnedMessagesList.innerHTML).toContain("Saved Message");
  });

  test("should delete a pinned message", () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) =>
          callback({ pinnedMessages: ["Message 1", "Message 2"] })
      );

      require("../popup.js");

      const deleteButton = document.querySelector("ul button");
      deleteButton.click();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
          { pinnedMessages: ["Message 2"] },
          expect.any(Function)
      );
  });

  test("should clear all pinned messages", () => {
      const clearButton = document.getElementById("clearMessages");
      clearButton.click();

      expect(chrome.storage.sync.remove).toHaveBeenCalledWith(
          "pinnedMessages",
          expect.any(Function)
      );
  });
});
