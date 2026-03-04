import { CONFERENCE_JOINED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';

import { closeDocPip, tryAutoPip } from './actions';
import { getBestPipMode } from './functions';

/**
 * Flag to prevent duplicate event listener registration.
 */
let listenersRegistered = false;

/**
 * References to event handlers so they can be removed.
 */
let onVisibilityChange: (() => void) | null = null;
let onWindowBlur: (() => void) | null = null;
let onWindowFocus: (() => void) | null = null;

/**
 * Middleware for the doc-pip feature.
 * Registers visibility change and window blur/focus listeners
 * when joining a conference and removes them when leaving.
 */
MiddlewareRegistry.register(store => next => action => {
    const result = next(action);

    switch (action.type) {
    case CONFERENCE_JOINED: {
        if (listenersRegistered) {
            break;
        }

        const mode = getBestPipMode();

        if (!mode) {
            break;
        }

        onVisibilityChange = () => {
            if (document.hidden) {
                store.dispatch(tryAutoPip());
            }
        };

        onWindowBlur = () => {
            // Only trigger if the document is not hidden (prevents double-fire
            // with visibilitychange on some platforms).
            if (!document.hidden) {
                store.dispatch(tryAutoPip());
            }
        };

        onWindowFocus = () => {
            const state = store.getState();
            const { isOpen } = state['features/doc-pip'];

            if (isOpen) {
                store.dispatch(closeDocPip());
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('blur', onWindowBlur);
        window.addEventListener('focus', onWindowFocus);
        listenersRegistered = true;
        break;
    }

    case CONFERENCE_LEFT: {
        if (!listenersRegistered) {
            break;
        }

        // Close any open PiP window.
        const state = store.getState();

        if (state['features/doc-pip']?.isOpen) {
            store.dispatch(closeDocPip());
        }

        // Remove listeners.
        if (onVisibilityChange) {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        }
        if (onWindowBlur) {
            window.removeEventListener('blur', onWindowBlur);
        }
        if (onWindowFocus) {
            window.removeEventListener('focus', onWindowFocus);
        }

        onVisibilityChange = null;
        onWindowBlur = null;
        onWindowFocus = null;
        listenersRegistered = false;
        break;
    }
    }

    return result;
});
