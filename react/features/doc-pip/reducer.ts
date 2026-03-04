import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    CLOSE_DOC_PIP,
    OPEN_DOC_PIP,
    RESET_DOC_PIP_STATE,
    SET_DOC_PIP_AUTO_ENABLED
} from './actionTypes';
import { IDocPipState } from './types';

/**
 * The default state for the doc-pip feature.
 */
const DEFAULT_STATE: IDocPipState = {
    isOpen: false,
    mode: null,
    autoEnabled: true,
    lastTriggerReason: null
};

/**
 * Reduces the Redux actions of the doc-pip feature.
 */
ReducerRegistry.register<IDocPipState>(
    'features/doc-pip',
    (state = DEFAULT_STATE, action): IDocPipState => {
        switch (action.type) {
        case OPEN_DOC_PIP:
            return {
                ...state,
                isOpen: true,
                mode: action.mode,
                lastTriggerReason: action.triggerReason ?? null
            };

        case CLOSE_DOC_PIP:
            return {
                ...state,
                isOpen: false,
                mode: null
            };

        case SET_DOC_PIP_AUTO_ENABLED:
            return {
                ...state,
                autoEnabled: action.enabled
            };

        case RESET_DOC_PIP_STATE:
            return {
                ...DEFAULT_STATE,
                autoEnabled: state.autoEnabled
            };

        default:
            return state;
        }
    }
);

export type { IDocPipState };
