/**
 * DocPipManager – singleton for managing the Document PiP window reference.
 *
 * Replaces the (window as any).__docPipWindow global variable with a clean,
 * type-safe, testable API that avoids polluting the global namespace.
 *
 * Pattern: module-level singleton instance exported as default.
 * Consumers import DocPipManager and call its methods directly.
 */

/**
 * Internal class – clients use the exported singleton instance.
 */
class DocPipManagerClass {
    private _window: Window | null = null;
    private _cleanup: (() => void) | null = null;
    private _channel: BroadcastChannel | null = null;

    private _ensureChannel(): void {
        if (this._channel || typeof BroadcastChannel === 'undefined') {
            return;
        }

        this._channel = new BroadcastChannel('jitsi-doc-pip');
        this._channel.onmessage = event => {
            if (event.data === 'open') {
                this.close();
            }
        };
    }

    /**
     * Stores the Document PiP window reference obtained from
     * {@code documentPictureInPicture.requestWindow()}.
     *
     * @param {Window} win - The PiP window to store.
     * @returns {void}
     */
    setWindow(win: Window, cleanup?: () => void): void {
        this._ensureChannel();

        this._window = win;
        this._cleanup = cleanup ?? null;

        this._channel?.postMessage('open');
    }

    /**
     * Returns the stored PiP window, or null if not open.
     *
     * @returns {Window | null}
     */
    getWindow(): Window | null {
        return this._window;
    }

    /**
     * Returns whether a live (non-closed) PiP window currently exists.
     *
     * @returns {boolean}
     */
    isActive(): boolean {
        return this._window !== null && !this._window.closed;
    }

    /**
     * Closes the PiP window (if open) and clears the stored reference.
     * Safe to call even when no window is open.
     *
     * @returns {void}
     */
    close(): void {
        if (this._window && !this._window.closed) {
            this._window.close();
        }
        this.clearRef();
    }

    /**
     * Clears the stored reference WITHOUT closing the window.
     * Use this when the window has already been closed externally (e.g. pagehide event).
     *
     * @returns {void}
     */
    clearRef(): void {
        if (this._cleanup) {
            this._cleanup();
        }
        this._window = null;
        this._cleanup = null;
    }
}

/**
 * Module-level singleton — import and use directly.
 *
 * @example
 * import DocPipManager from './DocPipManager';
 * DocPipManager.setWindow(pipWindow);
 * const win = DocPipManager.getWindow();
 */
const DocPipManager = new DocPipManagerClass();

export default DocPipManager;
