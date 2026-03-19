import ReducerRegistry from '../base/redux/ReducerRegistry';

import { BLOCK_DOC_PIP_AUTO_OPEN, CLOSE_DOC_PIP, SET_DOC_PIP_OPEN } from './actionTypes';
import { IDocPipState } from './types';

/**
 * The default state for the doc-pip feature.
 */
const DEFAULT_STATE: IDocPipState = {
    isOpen: false,
    mode: null,
    lastTriggerReason: null,
    // Timestamp (ms) until which auto-open is blocked due to user dismissal.
    autoOpenBlockedUntil: null
};

/**
 * Reduces the Redux actions of the doc-pip feature.
 */
ReducerRegistry.register<IDocPipState>(
    'features/doc-pip',
    (state = DEFAULT_STATE, action): IDocPipState => {
        switch (action.type) {
        case SET_DOC_PIP_OPEN:
            return {
                ...state,
                isOpen: action.isOpen,
                mode: action.mode,
                lastTriggerReason: action.reason ?? null
            };

        case CLOSE_DOC_PIP:
            return {
                ...state,
                isOpen: false,
                mode: null,
                lastTriggerReason: null
            };

        case BLOCK_DOC_PIP_AUTO_OPEN:
            return {
                ...state,
                autoOpenBlockedUntil: action.until ?? null
            };

        default:
            return state;
        }
    }
);
