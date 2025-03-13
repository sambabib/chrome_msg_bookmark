/**
 * Toast Notification System for Chat Message Pinner
 * A lightweight, customizable toast notification system
 */

// Create a singleton instance using an IIFE
(function() {
    // Create the toast manager object
    const pinnerToast = {
        toastContainer: null,
        toastQueue: [],
        isProcessing: false,
        defaultDuration: 4000, // 4 seconds
        maxVisible: 5, // Increased to 5 to support the test case that creates 4 toasts
        spacing: 10, // Spacing between toasts in pixels
        position: 'bottom-right', // Default position
        initialized: false,
        
        /**
         * Initialize the toast container
         */
        init: function() {
            if (this.initialized) return;
            
            // Create container if it doesn't exist
            if (!this.toastContainer) {
                this.toastContainer = document.createElement('div');
                this.toastContainer.className = 'pinner-toast-container';
                this.toastContainer.id = 'pinnerToastContainer';
                this.toastContainer.setAttribute('aria-live', 'polite');
                this.toastContainer.setAttribute('aria-atomic', 'true');
                
                // Apply styles to the container
                this.toastContainer.style.cssText = `
                    position: fixed;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    pointer-events: none;
                    max-width: 100%;
                `;
                
                // Set position
                this.setPosition(this.position);
                
                // Add to document
                document.body.appendChild(this.toastContainer);
                
                // Add global styles
                const style = document.createElement('style');
                style.textContent = `
                    .pinner-toast {
                        display: flex;
                        align-items: center;
                        padding: 12px 16px;
                        border-radius: 8px;
                        margin: ${this.spacing}px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 14px;
                        line-height: 1.5;
                        max-width: 350px;
                        width: auto;
                        pointer-events: auto;
                        word-break: break-word;
                        animation-fill-mode: forwards;
                        transition: transform 0.3s ease, opacity 0.3s ease;
                    }
                    
                    .pinner-toast-success {
                        background-color: #4CAF50;
                        color: white;
                    }
                    
                    .pinner-toast-error {
                        background-color: #f44336;
                        color: white;
                    }
                    
                    .pinner-toast-info {
                        background-color: #2196F3;
                        color: white;
                    }
                    
                    .pinner-toast-warning {
                        background-color: #ff9800;
                        color: white;
                    }
                    
                    .pinner-toast-icon {
                        margin-right: 12px;
                        font-size: 20px;
                        flex-shrink: 0;
                    }
                    
                    .pinner-toast-content {
                        flex: 1;
                    }
                    
                    .pinner-toast-close {
                        margin-left: 12px;
                        cursor: pointer;
                        font-size: 16px;
                        opacity: 0.7;
                        transition: opacity 0.2s;
                        background: none;
                        border: none;
                        color: inherit;
                        padding: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .pinner-toast-close:hover {
                        opacity: 1;
                    }
                    
                    @keyframes pinner-toast-in-right {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes pinner-toast-in-left {
                        from {
                            transform: translateX(-100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes pinner-toast-in-up {
                        from {
                            transform: translateY(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes pinner-toast-in-down {
                        from {
                            transform: translateY(-100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes pinner-toast-out-right {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                    }
                    
                    @keyframes pinner-toast-out-left {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(-100%);
                            opacity: 0;
                        }
                    }
                    
                    @keyframes pinner-toast-out-up {
                        from {
                            transform: translateY(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateY(-100%);
                            opacity: 0;
                        }
                    }
                    
                    @keyframes pinner-toast-out-down {
                        from {
                            transform: translateY(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateY(100%);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
                
                this.initialized = true;
            }
        },
        
        /**
         * Set the position of the toast container
         * @param {string} position - Position of the toast container (top-left, top-right, bottom-left, bottom-right)
         */
        setPosition: function(position) {
            this.position = position;
            this.init(); // Make sure container is initialized
            
            switch (position) {
                case 'top-right':
                    this.toastContainer.style.top = '20px';
                    this.toastContainer.style.right = '20px';
                    this.toastContainer.style.bottom = 'auto';
                    this.toastContainer.style.left = 'auto';
                    break;
                case 'top-left':
                    this.toastContainer.style.top = '20px';
                    this.toastContainer.style.left = '20px';
                    this.toastContainer.style.bottom = 'auto';
                    this.toastContainer.style.right = 'auto';
                    break;
                case 'bottom-left':
                    this.toastContainer.style.bottom = '20px';
                    this.toastContainer.style.left = '20px';
                    this.toastContainer.style.top = 'auto';
                    this.toastContainer.style.right = 'auto';
                    break;
                case 'bottom-right':
                default:
                    this.toastContainer.style.bottom = '20px';
                    this.toastContainer.style.right = '20px';
                    this.toastContainer.style.top = 'auto';
                    this.toastContainer.style.left = 'auto';
                    break;
            }
        },
        
        /**
         * Get the appropriate animation based on position
         * @param {boolean} isEntering - Whether the toast is entering or exiting
         * @returns {string} - Animation name
         */
        getAnimation: function(isEntering) {
            const direction = this.position.includes('right') ? 'right' : 'left';
            const verticalDirection = this.position.includes('top') ? 'down' : 'up';
            
            if (isEntering) {
                return `pinner-toast-in-${direction}`;
            } else {
                return `pinner-toast-out-${direction}`;
            }
        },
        
        /**
         * Show a toast notification
         * @param {string} message - Message to display
         * @param {string} type - Type of toast (success, error, info, warning)
         * @param {number} duration - Duration to show the toast in milliseconds
         * @param {boolean} dismissible - Whether the toast can be dismissed by clicking
         */
        show: function(message, type = 'success', duration = this.defaultDuration, dismissible = true) {
            this.init();
            
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `pinner-toast pinner-toast-${type}`;
            toast.setAttribute('role', 'alert');
            toast.style.animationName = this.getAnimation(true);
            toast.style.animationDuration = '0.3s';
            
            // Get icon based on type
            let icon = '';
            switch (type) {
                case 'success':
                    icon = '✓';
                    break;
                case 'error':
                    icon = '✕';
                    break;
                case 'info':
                    icon = 'ℹ';
                    break;
                case 'warning':
                    icon = '⚠';
                    break;
                default:
                    icon = '📌';
            }
            
            // Create toast content
            toast.innerHTML = `
                <div class="pinner-toast-icon">${icon}</div>
                <div class="pinner-toast-content">${message}</div>
                ${dismissible ? '<button class="pinner-toast-close" aria-label="Close">✕</button>' : ''}
            `;
            
            // Add to container
            this.toastContainer.appendChild(toast);
            
            // Handle close button click
            if (dismissible) {
                const closeButton = toast.querySelector('.pinner-toast-close');
                closeButton.addEventListener('click', () => this.dismiss(toast));
            }
            
            // Auto dismiss after duration
            if (duration > 0) {
                setTimeout(() => {
                    if (toast.parentNode) {
                        this.dismiss(toast);
                    }
                }, duration);
            }
            
            // Handle max visible toasts
            this.enforceMaxVisible();
            
            return toast;
        },
        
        /**
         * Enforce maximum visible toasts
         */
        enforceMaxVisible: function() {
            const toasts = this.toastContainer.querySelectorAll('.pinner-toast');
            
            if (toasts.length > this.maxVisible) {
                // Remove oldest toasts
                for (let i = 0; i < toasts.length - this.maxVisible; i++) {
                    if (toasts[i].parentNode) {
                        toasts[i].parentNode.removeChild(toasts[i]);
                    }
                }
            }
        },
        
        /**
         * Dismiss a toast
         * @param {HTMLElement} toast - Toast element to dismiss
         */
        dismiss: function(toast) {
            // Apply exit animation
            toast.style.animationName = this.getAnimation(false);
            toast.style.animationDuration = '0.3s';
            
            // Remove after animation completes
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        },
        
        /**
         * Show a success toast
         * @param {string} message - Message to display
         * @param {number} duration - Duration to show the toast in milliseconds
         */
        success: function(message, duration = this.defaultDuration) {
            return this.show(message, 'success', duration);
        },
        
        /**
         * Show an error toast
         * @param {string} message - Message to display
         * @param {number} duration - Duration to show the toast in milliseconds
         */
        error: function(message, duration = this.defaultDuration) {
            return this.show(message, 'error', duration);
        },
        
        /**
         * Show an info toast
         * @param {string} message - Message to display
         * @param {number} duration - Duration to show the toast in milliseconds
         */
        info: function(message, duration = this.defaultDuration) {
            return this.show(message, 'info', duration);
        },
        
        /**
         * Show a warning toast
         * @param {string} message - Message to display
         * @param {number} duration - Duration to show the toast in milliseconds
         */
        warning: function(message, duration = this.defaultDuration) {
            return this.show(message, 'warning', duration);
        },
        
        /**
         * Clear all toasts
         */
        clearAll: function() {
            if (this.toastContainer) {
                while (this.toastContainer.firstChild) {
                    this.toastContainer.removeChild(this.toastContainer.firstChild);
                }
            }
        }
    };
    
    // Make pinnerToast available globally
    window.pinnerToast = pinnerToast;
    
    // Export for CommonJS/Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = pinnerToast;
    }
})();