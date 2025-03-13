/**
 * @jest-environment jsdom
 */

const { fireEvent } = require("@testing-library/dom");
require("@testing-library/jest-dom");

describe("Toast Notification System", () => {
    beforeEach(() => {
        // Reset the DOM before each test
        document.body.innerHTML = '';
        
        // Reset modules
        jest.resetModules();
        
        // Clear any existing toast instances
        if (window.pinnerToast) {
            delete window.pinnerToast;
        }
    });
    
    function loadToastScript() {
        require("./toast.js");
        return window.pinnerToast;
    }
    
    test("should initialize toast container on first use", () => {
        const toast = loadToastScript();
        
        // Show a toast to trigger initialization
        toast.success("Test message");
        
        // Check if toast container was created
        const container = document.getElementById("pinnerToastContainer");
        expect(container).toBeTruthy();
        expect(container.className).toBe("pinner-toast-container");
    });
    
    test("should create toast with correct styling based on type", () => {
        const toast = loadToastScript();
        
        // Test different toast types
        toast.success("Success message");
        toast.error("Error message");
        toast.info("Info message");
        toast.warning("Warning message");
        
        // Check if toasts were created with correct classes
        const toasts = document.querySelectorAll(".pinner-toast");
        expect(toasts.length).toBe(4);
        
        expect(toasts[0].classList.contains("pinner-toast-success")).toBe(true);
        expect(toasts[1].classList.contains("pinner-toast-error")).toBe(true);
        expect(toasts[2].classList.contains("pinner-toast-info")).toBe(true);
        expect(toasts[3].classList.contains("pinner-toast-warning")).toBe(true);
    });
    
    test("should display correct message content", () => {
        const toast = loadToastScript();
        
        // Show a toast with a specific message
        const testMessage = "This is a test notification";
        toast.success(testMessage);
        
        // Check if the message is displayed correctly
        const toastContent = document.querySelector(".pinner-toast-content");
        expect(toastContent.textContent).toBe(testMessage);
    });
    
    test("should remove toast after specified duration", async () => {
        jest.useFakeTimers();
        
        const toast = loadToastScript();
        
        // Show a toast with a short duration
        toast.success("Quick message", 500);
        
        // Check if toast exists
        let toastElement = document.querySelector(".pinner-toast");
        expect(toastElement).toBeTruthy();
        
        // Fast-forward time
        jest.advanceTimersByTime(800);
        
        // Check if toast was removed
        toastElement = document.querySelector(".pinner-toast");
        expect(toastElement).toBeFalsy();
        
        jest.useRealTimers();
    });
    
    test("should dismiss toast when close button is clicked", () => {
        jest.useFakeTimers();
        
        const toast = loadToastScript();
        
        // Show a toast with a long duration to ensure it doesn't auto-dismiss during test
        toast.success("Dismissible message", 10000);
        
        // Find the close button and click it
        const closeButton = document.querySelector(".pinner-toast-close");
        expect(closeButton).toBeTruthy();
        
        fireEvent.click(closeButton);
        
        // Fast-forward time for animation
        jest.advanceTimersByTime(400);
        
        // Check if toast was removed
        const toastElement = document.querySelector(".pinner-toast");
        expect(toastElement).toBeFalsy();
        
        jest.useRealTimers();
    });
    
    test("should limit the number of visible toasts", () => {
        const toast = loadToastScript();
        
        // Set max visible to a small number for testing
        toast.maxVisible = 2;
        
        // Show more toasts than the max visible limit
        toast.success("First message");
        toast.success("Second message");
        toast.success("Third message");
        toast.success("Fourth message");
        
        // Check if only the max number of toasts are displayed
        const toasts = document.querySelectorAll(".pinner-toast");
        expect(toasts.length).toBe(2);
    });
    
    test("should change position based on setPosition method", () => {
        const toast = loadToastScript();
        
        // Default position should be bottom-right
        toast.success("Default position");
        
        let container = document.getElementById("pinnerToastContainer");
        expect(container.style.bottom).toBe("20px");
        expect(container.style.right).toBe("20px");
        
        // Change position to top-left
        toast.setPosition("top-left");
        
        expect(container.style.top).toBe("20px");
        expect(container.style.left).toBe("20px");
        
        // Change position to top-right
        toast.setPosition("top-right");
        
        expect(container.style.top).toBe("20px");
        expect(container.style.right).toBe("20px");
        
        // Change position to bottom-left
        toast.setPosition("bottom-left");
        
        expect(container.style.bottom).toBe("20px");
        expect(container.style.left).toBe("20px");
    });
    
    test("should clear all toasts when clearAll is called", () => {
        const toast = loadToastScript();
        
        // Show multiple toasts
        toast.success("First message");
        toast.success("Second message");
        toast.success("Third message");
        
        // Check if toasts were created
        let toasts = document.querySelectorAll(".pinner-toast");
        expect(toasts.length).toBe(3);
        
        // Clear all toasts
        toast.clearAll();
        
        // Check if all toasts were removed
        toasts = document.querySelectorAll(".pinner-toast");
        expect(toasts.length).toBe(0);
    });
    
    test("should be accessible globally as window.pinnerToast", () => {
        loadToastScript();
        
        // Check if the toast is available globally
        expect(window.pinnerToast).toBeDefined();
        expect(typeof window.pinnerToast.success).toBe('function');
        expect(typeof window.pinnerToast.error).toBe('function');
        expect(typeof window.pinnerToast.info).toBe('function');
        expect(typeof window.pinnerToast.warning).toBe('function');
    });
});
