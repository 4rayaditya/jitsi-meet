import { AnyAction } from 'redux';

import { CONFERENCE_JOINED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';

import { closePip, openPip } from './actions';
import { getBestPipMode } from './functions';
import logger from './logger';

/**
 * Module-level references to the tab-switch auto-PiP event handlers so they
 * can be unregistered when the conference ends.
 */
let _blurHandler: (() => void) | null = null;
let _visibilityHandler: (() => void) | null = null;

/**
 * Middleware for the doc-pip feature.
 *
 * Handles conference lifecycle events to manage PiP state:
 *   - CONFERENCE_JOINED → registers tab-switch listeners for auto-PiP.
 *   - CONFERENCE_LEFT  → unregisters listeners and closes any open PiP window.
 */
MiddlewareRegistry.register(store => next => (action: AnyAction) => {
    const result = next(action);

    switch (action.type) {

    case CONFERENCE_JOINED: {
        const { docPip } = store.getState()['features/base/config'];
        const autoOpenOnTabSwitch = docPip?.autoOpenOnTabSwitch ?? true;

        if (!autoOpenOnTabSwitch) {
            logger.debug('Conference joined — DocPiP auto-open disabled via config');
            break;
        }

        logger.debug('Conference joined — DocPiP triggers enabled');

        /**
         * Triggers PiP when the user leaves the tab, provided PiP is
         * not already open and the environment supports it.
         */
        const maybeOpenPip = () => {
            const { isOpen, autoOpenBlockedUntil } = store.getState()['features/doc-pip'];

            // Respect temporary blocks caused by user dismissals.
            if (autoOpenBlockedUntil && Date.now() < autoOpenBlockedUntil) {
                logger.debug('Tab hidden — auto-open blocked until', new Date(autoOpenBlockedUntil).toISOString());

                return;
            }

            if (!isOpen && getBestPipMode()) {
                logger.debug('Tab hidden / blurred — auto-opening PiP');
                store.dispatch(openPip('tab-switch'));
            }
        };

        _blurHandler = () => maybeOpenPip();
        _visibilityHandler = () => {
            if (document.hidden) {
                maybeOpenPip();
            }
        };

        window.addEventListener('blur', _blurHandler);
        document.addEventListener('visibilitychange', _visibilityHandler);
        break;
    }

    case CONFERENCE_LEFT:
        logger.debug('Conference left — closing PiP if open');

        if (_blurHandler) {
            window.removeEventListener('blur', _blurHandler);
            _blurHandler = null;
        }
        if (_visibilityHandler) {
            document.removeEventListener('visibilitychange', _visibilityHandler);
            _visibilityHandler = null;
        }

        store.dispatch(closePip(false));
        break;
    }

    return result;
});
