/*
 Brents-Toasts ("Snackbar System v2")
 Version 1.0
 Under Apache License 2.0
 Brentspine 2026
*/

const MAX_TOASTS = 5;

const ToastColor = {
    INFO: '#28a6f5ff',
    SUCCESS: '#4bb543ff',
    WARNING: '#dfb200ff',
    ERROR: '#ff4433ff'
};

class Toasts {
    constructor() {
        this.appendStyle();
        this.snackbar = this.createSnackbar();
    }

    showToast(message, color = ToastColor.INFO, duration = 3000, closable = true) {
        // Count only active (non-hiding) toasts
        const activeToasts = Array.from(this.snackbar.children).filter(
            toast => !toast.classList.contains('hiding')
        );
        if (activeToasts.length >= MAX_TOASTS) {
            // Remove oldest toast
            const oldestToast = activeToasts[0];
            this.removeToast(oldestToast.id);
        }

        // Move up existing toasts
        Array.from(this.snackbar.children).reverse().forEach((toastContainer, index) => {
            const newBottom = 22 + (index + 1) * 50;
            toastContainer.style.bottom = `${newBottom}px`;
        });
        
        // Create and append toast
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.bottom = '0px';
        toastContainer.style.opacity = '0';
        toastContainer.id = `toast-${Math.random().toString(36).substr(2, 9)}`;
        const toast = document.createElement('div');
        toast.className = 'toast show';
        if (closable) {
            toast.classList.add('closable');
        }
        const toastClose = document.createElement('div');
        toastClose.className = 'toast-close';
        toastClose.style.setProperty('--data-background', color);
        const closeSpan = document.createElement('span');
        closeSpan.innerHTML = '×';
        toastClose.appendChild(closeSpan);
        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';
        toastContent.innerHTML = message;
        toast.appendChild(toastClose);
        toast.appendChild(toastContent);
        toastContainer.appendChild(toast);
        this.snackbar.appendChild(toastContainer);
        setTimeout(() => {
            toastContainer.style.bottom = '22px';
            toastContainer.style.opacity = '1';
        }, 10);

        // Close on click
        if (closable) {
            toast.addEventListener('click', () => {
                this.removeToast(toastContainer.id);
            });
        }
        // Auto-remove after duration
        if (duration && duration > 0) {
            setTimeout(() => {
                this.removeToast(toastContainer.id);
            }, duration);
        }
        return toastContainer.id;
    }

    removeToast(id) {
        const toastContainer = document.getElementById(id);
        if(!toastContainer) return;
        // Mark as hiding so it's not counted as active
        toastContainer.classList.add('hiding');
        // Apply fade out via opacity
        toastContainer.style.opacity = '0';
        // Remove from DOM after transition
        setTimeout(() => {
            if (toastContainer.parentNode) {
                toastContainer.parentNode.removeChild(toastContainer);
            }
        }, 300);
        // Move down toasts above removed one
        Array.from(this.snackbar.children).forEach((otherToastContainer) => {
            if (otherToastContainer === toastContainer) return;
            const currentBottom = parseInt(otherToastContainer.style.bottom);
            const removedBottom = parseInt(toastContainer.style.bottom);
            if (currentBottom > removedBottom) {
                const newBottom = currentBottom - 50;
                otherToastContainer.style.bottom = `${newBottom}px`;
            }
        });
    }
 
    appendStyle() {
        if (document.getElementById('toasts-styles')) return;
        const style = document.createElement('style');
        style.innerHTML = `
            #snackbar {
                position: fixed;
                width: 100vw;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                align-items: center;
                --font-size: 14px;
            }

            .toast-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                position: fixed !important;
                transition: opacity 0.3s ease-in-out, bottom 0.2s ease-in-out;
            }
            .toast {
                min-width: 350px;
                background-color: #333;
                border-radius: 2px;
                width: auto;
                display: flex;
                height: 47px;
                align-items: center;
                border-radius: 3px;
                font-size: var(--font-size);
            }
            .toast-close {
                border-radius: 2px 0 0 2px;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--data-background, #555);
                width: 4.5px;
                overflow: hidden;
                transition: 0.2s;
            }
            .toast-close span {
                opacity: 0;
            }
            .toast.closable:hover .toast-close span {
                opacity: 1;
            }
            
            .toast.closable:hover .toast-close {
                cursor: pointer;
                width: 20px;
            }

            .toast .toast-content {
                margin-left: 10px;
            }
        `;
        style.id = 'toasts-styles';
        document.head.appendChild(style);
        document.head.insertBefore(document.createComment('Appended by Toasts by brents-toasts'), style);
    }

    createSnackbar() {
        if (document.getElementById('snackbar')) {
            return document.getElementById('snackbar');
        }
        const snackbar = document.createElement('div');
        snackbar.id = 'snackbar';
        document.body.appendChild(snackbar);
        document.body.insertBefore(document.createComment('Snackbar container created by brents-toasts'), snackbar);
        return snackbar;
    }

}

export const toasts = new Toasts();
export { ToastColor };
