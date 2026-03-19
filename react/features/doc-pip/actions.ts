import { createPipEvent } from '../analytics/AnalyticsEvents';
import { sendAnalytics } from '../analytics/functions';
import { IStore } from '../app/types';
import { getLargeVideoParticipant } from '../large-video/functions';
import { getPiPVideoTrack } from '../pip/functions';

import DocPipManager from './DocPipManager';
import { enterVideoPip, exitVideoPip } from './VideoPipManager';
import { CLOSE_DOC_PIP, SET_DOC_PIP_OPEN } from './actionTypes';
import { getBestPipMode, openDocPipWindow } from './functions';
import logger from './logger';
/**
 * Action to open the PiP window using the best available mode.
 *
 * @param {string} reason - The trigger reason (e.g. 'button', 'shortcut', 'tab-switch').
 * @returns {Function}
 */
export function openPip(reason: string) {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const { isOpen } = getState()['features/doc-pip'];

        if (isOpen) {
            logger.warn('PiP is already open');

            return;
        }

        const mode = getBestPipMode();

        if (!mode) {
            logger.warn('No PiP mode available in this environment');
            sendAnalytics(createPipEvent('error', {
                reason,
                error: 'no_mode_available'
            }));

            return;
        }

        if (mode === 'doc') {
            try {
                const { pipWindow, stopStyleSync } = await openDocPipWindow();

                // Store the PiP window reference in the singleton manager
                // (avoids polluting the global namespace).
                DocPipManager.setWindow(pipWindow, stopStyleSync);

                dispatch({
                    type: SET_DOC_PIP_OPEN,
                    isOpen: true,
                    mode: 'doc',
                    reason
                });

                sendAnalytics(createPipEvent('open', {
                    mode: 'doc',
                    reason
                }));

                // Clean up when the user closes the PiP window (X button or browser).
                pipWindow.addEventListener('pagehide', () => {
                    DocPipManager.clearRef(); // already closed, just drop the ref
                    dispatch(closePip());
                }, { once: true });

                // Clean up if the main page is unloaded (tab close / navigation).
                window.addEventListener('beforeunload', () => {
                    DocPipManager.close();
                }, { once: true });

                logger.info('Document PiP window opened');
            } catch (error) {
                logger.error('Failed to open Document PiP, falling back to Video PiP:', error);

                sendAnalytics(createPipEvent('fallback', {
                    reason,
                    from: 'doc',
                    to: 'video'
                }));

                // Fallback to Video PiP.
                _openVideoPip(dispatch, reason);
            }
        } else {
            _openVideoPip(dispatch, reason);
        }
    };
}

/**
 * Opens Video PiP mode.
 *
 * @param {Function} dispatch - Redux dispatch.
 * @param {string} reason - The trigger reason.
 * @returns {void}
 */
async function _openVideoPip(dispatch: IStore['dispatch'], reason: string) {
    try {
        // Ensure the hidden PiP video element exists; if missing, try a temporary
        // hidden <video> element attached to the DOM and attach the large-video
        // track to it before requesting Picture-in-Picture. This increases
        // reliability when the static #pipVideo may not yet be ready.
        let pipVideoElement = document.getElementById('pipVideo') as HTMLVideoElement | null;

        if (!pipVideoElement) {
            logger.debug('#pipVideo not found — attempting temporary video fallback');

            try {
                const state = APP.store?.getState?.() || {};
                const largeParticipant = getLargeVideoParticipant(state);
                const videoTrack = getPiPVideoTrack(state, largeParticipant);

                if (videoTrack?.jitsiTrack) {
                    const temp = document.createElement('video');

                    temp.id = 'pipVideo-temp';
                    temp.autoplay = true;
                    temp.muted = true;
                    temp.playsInline = true;
                    temp.style.position = 'absolute';
                    temp.style.width = '1px';
                    temp.style.height = '1px';
                    temp.style.left = '-9999px';
                    temp.style.top = '-9999px';
                    document.body.appendChild(temp);

                    // Attach Jitsi track to the temporary element and wait for metadata.
                    try {
                        // @ts-ignore
                        videoTrack.jitsiTrack.attach(temp);

                        if (temp.readyState < 1) {
                            await new Promise(resolve => temp.addEventListener('loadedmetadata', resolve, { once: true }));
                        }

                        // Ensure playback has started; some browsers need an explicit play()
                        // even when muted before entering PiP.
                        try {
                            // Play returns a promise — await to ensure media is streaming.
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            await temp.play();
                        } catch (playErr) {
                            logger.warn('Temporary PiP video play() failed or was unnecessary', playErr);
                        }

                        // @ts-ignore requestPictureInPicture may not be typed.
                        await temp.requestPictureInPicture();

                        // Clean up when the temporary element leaves PiP.
                        const cleanupTemp = () => {
                            try {
                                // @ts-ignore
                                videoTrack.jitsiTrack.detach(temp);
                            } catch (e) {
                                // ignore
                            }

                            try {
                                temp.remove();
                            } catch (e) {
                                // ignore
                            }
                        };

                        temp.addEventListener('leavepictureinpicture', cleanupTemp, { once: true });

                        logger.info('Temporary PiP video entered picture-in-picture');
                        pipVideoElement = temp;
                    } catch (err) {
                        logger.error('Temporary PiP fallback failed:', err);
                        // cleanup
                        try {
                            temp.remove();
                        } catch (e) {
                            // ignore
                        }
                    }
                } else {
                    logger.warn('No available video track for temporary PiP fallback');
                }
            } catch (err) {
                logger.error('Error during temporary PiP fallback:', err);
            }
        } else {
            // @ts-ignore
            enterVideoPip();
        }
        // If pipVideoElement is present or temporary fallback succeeded, update state.
        if (document.pictureInPictureElement || pipVideoElement) {
            dispatch({
                type: SET_DOC_PIP_OPEN,
                isOpen: true,
                mode: 'video',
                reason
            });
            sendAnalytics(createPipEvent('open', {
                mode: 'video',
                reason
            }));
            logger.info('Video PiP entered');
        } else {
            logger.error('Failed to enter Video PiP: no active PiP element');
            sendAnalytics(createPipEvent('error', {
                mode: 'video',
                reason,
                error: 'video_pip_failed'
            }));
        }
    } catch (error) {
        logger.error('Failed to enter Video PiP:', error);
        sendAnalytics(createPipEvent('error', {
            mode: 'video',
            reason,
            error: 'video_pip_failed'
        }));
    }
}

/**
 * Action to close any open PiP window.
 *
 * @returns {Function}
 */
export function closePip(blockAutoOpen: boolean = false) {
    return (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const { isOpen, mode, lastTriggerReason } = getState()['features/doc-pip'];

        if (!isOpen) {
            return;
        }

        if (mode === 'doc') {
            DocPipManager.close();
        } else if (mode === 'video') {
            exitVideoPip();
        }

        dispatch({ type: CLOSE_DOC_PIP });
        if (blockAutoOpen) {
            dispatch({ type: BLOCK_DOC_PIP_AUTO_OPEN, until: Date.now() + 5 * 60 * 1000 }); // Block for 5 minutes
        }
        sendAnalytics(createPipEvent('close', {
            mode,
            reason: lastTriggerReason ?? undefined
        }));
        logger.info('PiP closed');
    };
}

/**
 * Toggles PiP open/closed.
 *
 * @param {string} reason - The trigger reason (e.g. 'button', 'shortcut').
 * @returns {Function}
 */
export function togglePip(reason: string) {
    return (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const { isOpen } = getState()['features/doc-pip'];

        if (isOpen) {
            dispatch(closePip());
        } else {
            dispatch(openPip(reason));
        }
    };
}
