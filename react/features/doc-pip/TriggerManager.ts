import {
    AUTO_PIP_TRIGGER_DELAY_MS,
    PIP_FLICKER_GUARD_MS
} from './constants';
import { DocPipTriggerReason } from './types';

interface ITriggerManagerOptions {
    isEnabled: () => boolean;
    isPipOpen: () => boolean;
    onOpen: (reason: Exclude<DocPipTriggerReason, 'manual' | null>) => void;
    onClose: () => void;
}

const requestIdle =
    (window as any).requestIdleCallback
    || ((cb: Function) => window.setTimeout(cb, 16));

const cancelIdle =
    (window as any).cancelIdleCallback
    || ((id: number) => window.clearTimeout(id));

export default class TriggerManager {
    private _options: ITriggerManagerOptions;

    private _pendingOpenTimeout: number | null = null;

    private _pendingReason: Exclude<DocPipTriggerReason, 'manual' | null> | null = null;

    private _idleRequestId: number | null = null;

    private _lastOpenedAt = 0;

    private _isStarted = false;

    private _isWindowFocused = true;

    constructor(options: ITriggerManagerOptions) {
        this._options = options;
    }

    start() {
        if (this._isStarted) {
            return;
        }

        this._isStarted = true;
        this._isWindowFocused = document.visibilityState === 'visible' && document.hasFocus();

        document.addEventListener('visibilitychange', this._onVisibilityChange);
        window.addEventListener('blur', this._onBlur);
        window.addEventListener('focus', this._onFocus);
        window.addEventListener('resize', this._onResize);
        window.addEventListener('pagehide', this._onPageHide);

        document.addEventListener('freeze', this._onFreeze as EventListener);
        document.addEventListener('resume', this._onResume as EventListener);
    }

    stop() {
        if (!this._isStarted) {
            return;
        }

        this._isStarted = false;

        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('blur', this._onBlur);
        window.removeEventListener('focus', this._onFocus);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('pagehide', this._onPageHide);

        document.removeEventListener('freeze', this._onFreeze as EventListener);
        document.removeEventListener('resume', this._onResume as EventListener);

        this._clearPendingOpen();
        this._clearIdle();
    }

    markOpened() {
        this._lastOpenedAt = Date.now();
    }

    private _onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            this._isWindowFocused = false;
            this._scheduleRequest('tab');

            return;
        }

        this._isWindowFocused = true;
        this._handleForegroundReturn();
    };

    private _onBlur = () => {
        this._isWindowFocused = false;

        if (document.visibilityState !== 'hidden') {
            this._scheduleRequest('blur');
        }
    };

    private _onFocus = () => {
        this._isWindowFocused = true;
        this._handleForegroundReturn();
    };

    private _onResize = () => {
        if (window.innerWidth === 0 || window.innerHeight === 0) {
            this._scheduleRequest('minimize');
        }
    };

    private _onPageHide = () => {
        this._scheduleRequest('minimize');
    };

    private _onFreeze = () => {
        this._scheduleRequest('minimize');
    };

    private _onResume = () => {
        if (this._isWindowFocused && document.visibilityState === 'visible') {
            this._handleForegroundReturn();
        }
    };

    private _scheduleRequest(reason: Exclude<DocPipTriggerReason, 'manual' | null>) {
        if (!this._isStarted || !this._options.isEnabled()) {
            return;
        }

        this._pendingReason = reason;
        this._clearPendingOpen();
        this._clearIdle();

        this._idleRequestId = requestIdle(() => {
            this._idleRequestId = null;

            this._pendingOpenTimeout = window.setTimeout(() => {
                this._pendingOpenTimeout = null;

                if (!this._pendingReason || !this._options.isEnabled() || this._isWindowFocused || this._options.isPipOpen()) {
                    return;
                }

                this._options.onOpen(this._pendingReason);
                this._pendingReason = null;
            }, AUTO_PIP_TRIGGER_DELAY_MS);
        });
    }

    private _handleForegroundReturn() {
        this._clearPendingOpen();
        this._pendingReason = null;

        const shouldDelayClose = Date.now() - this._lastOpenedAt < PIP_FLICKER_GUARD_MS;

        if (this._options.isPipOpen() && !shouldDelayClose) {
            this._options.onClose();
        }
    }

    private _clearPendingOpen() {
        if (this._pendingOpenTimeout) {
            window.clearTimeout(this._pendingOpenTimeout);
            this._pendingOpenTimeout = null;
        }
    }

    private _clearIdle() {
        if (this._idleRequestId) {
            cancelIdle(this._idleRequestId);
            this._idleRequestId = null;
        }
    }
}
