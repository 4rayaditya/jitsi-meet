import { IStore } from '../app/types';
import { updateSettings } from '../base/settings/actions';

import {
    CLOSE_DOC_PIP,
    OPEN_DOC_PIP,
    RESET_DOC_PIP_STATE,
    SET_DOC_PIP_AUTO_ENABLED
} from './actionTypes';
import {
    canOpenPipInCurrentState,
    closeCurrentDocPipWindow,
    getBestPipMode,
    logDocPipEvent,
    openDocPipWindow,
    supportsDocPip
} from './functions';
import { DocPipMode, DocPipTriggerReason } from './types';
import VideoPipManager from './VideoPipManager';

/**
 * Action to open the PiP window in the given mode.
 *
 * @param {DocPipMode} mode - The PiP mode ('doc' or 'video').
 * @returns {{
 *     type: OPEN_DOC_PIP,
 *     mode: DocPipMode
 * }}
 */
export function openDocPipAction(mode: DocPipMode, triggerReason: DocPipTriggerReason) {
    return {
        type: OPEN_DOC_PIP,
        mode,
        triggerReason
    };
}

/**
 * Action to close the PiP window and reset state.
 *
 * @returns {{
 *     type: CLOSE_DOC_PIP
 * }}
 */
export function closeDocPipAction() {
    return {
        type: CLOSE_DOC_PIP
    };
}

export function setAutoPipEnabledAction(enabled: boolean) {
    return {
        type: SET_DOC_PIP_AUTO_ENABLED,
        enabled
    };
}

export function resetDocPipState() {
    return {
        type: RESET_DOC_PIP_STATE
    };
}

export function setAutoPipEnabled(enabled: boolean) {
    return (dispatch: IStore['dispatch']) => {
        dispatch(setAutoPipEnabledAction(enabled));
        dispatch(updateSettings({ autoPipEnabled: enabled }));
    };
}

/**
 * Thunk to open PiP. Determines the best mode and opens accordingly.
 * For DocPiP: dispatches action and lets DocPipWindow component handle the open.
 * For VideoPiP: grabs the existing hidden video element and calls requestPictureInPicture.
 *
 * @returns {Function}
 */
export function openDocPip(triggerReason: DocPipTriggerReason = 'manual') {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();
        const { isOpen } = state['features/doc-pip'];

        if (isOpen || !canOpenPipInCurrentState(state)) {
            return;
        }

        const mode = getBestPipMode();

        if (!mode) {
            return;
        }

        if (mode === 'doc') {
            try {
                await openDocPipWindow();
                dispatch(openDocPipAction('doc', triggerReason));
                logDocPipEvent({
                    action: 'opened',
                    mode: 'doc',
                    triggerReason
                });

                return;
            } catch (error) {
                logDocPipEvent({
                    action: 'failed',
                    mode: 'doc',
                    triggerReason
                });
                // Fall back to video PiP when DocPiP cannot be opened.
            }
        }

        if (mode === 'doc' || mode === 'video') {
            try {
                await VideoPipManager.enter();
                dispatch(openDocPipAction('video', triggerReason));
                logDocPipEvent({
                    action: 'opened',
                    mode: 'video',
                    triggerReason
                });
            } catch (error) {
                logDocPipEvent({
                    action: 'failed',
                    mode: 'video',
                    triggerReason
                });
            }
        }
    };
}

/**
 * Thunk to close any active PiP window (doc or video).
 *
 * @returns {Function}
 */
export function closeDocPip() {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();
        const { isOpen, mode } = state['features/doc-pip'];

        if (!isOpen) {
            return;
        }

        if (mode === 'video') {
            try {
                await VideoPipManager.exit();
            } catch (error) {
                // noop
            }
        } else if (mode === 'doc') {
            closeCurrentDocPipWindow();
        }

        dispatch(closeDocPipAction());
        logDocPipEvent({
            action: 'closed',
            mode
        });
    };
}

/**
 * Thunk to attempt automatic PiP when the user switches tabs or minimizes.
 * Tries DocPiP first (may fail without user gesture), falls back to Video PiP.
 *
 * @returns {Function}
 */
export function tryAutoPip(reason: Exclude<DocPipTriggerReason, 'manual' | null> = 'tab') {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();
        const { autoEnabled, isOpen } = state['features/doc-pip'];

        if (isOpen || !autoEnabled || !canOpenPipInCurrentState(state)) {
            return;
        }

        logDocPipEvent({
            action: 'triggered',
            triggerReason: reason
        });

        if (supportsDocPip()) {
            await dispatch<any>(openDocPip(reason));

            return;
        }

        await dispatch<any>(openDocPip(reason));
    };
}
