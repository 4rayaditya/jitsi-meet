import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState, IStore } from '../app/types';
import { leaveConference } from '../base/conference/actions';
import { getConferenceName, getConferenceTimestamp } from '../base/conference/functions';
import Icon from '../base/icons/components/Icon';
import {
    IconArrowUp,
    IconHangup,
    IconMessage,
    IconMic,
    IconMicSlash,
    IconRaiseHand,
    IconScreenshare,
    IconVideo,
    IconVideoOff
} from '../base/icons/svg';
import { MEDIA_TYPE } from '../base/media/constants';
import { raiseHand } from '../base/participants/actions';
import {
    getLocalParticipant,
    getParticipantCountForDisplay,
    getParticipantDisplayName,
    hasRaisedHand
} from '../base/participants/functions';
import { getVideoTrackByParticipant, isLocalTrackMuted } from '../base/tracks/functions.any';
import { toggleChat } from '../chat/actions.web';
import { isTrackStreamingStatusActive } from '../connection-indicator/functions';
import { getLargeVideoParticipant } from '../large-video/functions';
import { startScreenShareFlow } from '../screen-share/actions.web';
import { isScreenVideoShared } from '../screen-share/functions';
import { handleToggleVideoMuted } from '../toolbox/actions.any';
import { muteLocal } from '../video-menu/actions.any';

import DocPipManager from './DocPipManager';
import { closePip } from './actions';
import { DOMINANT_SPEAKER_HYSTERESIS_MS } from './constants';
import { formatDuration } from './functions';
import logger from './logger';

// ── Styles ──────────────────────────────────────────────────────────

const useStyles = makeStyles()(theme => ({
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.ui01 ?? '#1C2026',
        color: theme.palette.text01 ?? '#fff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden',
        margin: 0,
        padding: 0
    },

    // ── Header ──
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: theme.palette.ui02 ?? '#292929',
        borderBottom: `1px solid ${theme.palette.ui03 ?? '#444'}`
    },
    headerLeft: {
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        flex: 1,
        marginRight: 8
    },
    meetingTitle: {
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    metaRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        opacity: 0.7,
        marginTop: 2
    },
    returnButton: {
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        color: theme.palette.action01 ?? '#246FE5',
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap' as const,
        '&:hover': {
            backgroundColor: 'rgba(36,111,229,0.15)'
        }
    },
    returnIcon: {
        display: 'inline-flex',
        marginRight: 6
    },

    // ── Video area ──
    videoArea: {
        position: 'relative' as const,
        flex: 1,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const
    },
    avatarFallback: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    avatarCircle: {
        width: 72,
        height: 72,
        borderRadius: '50%',
        backgroundColor: theme.palette.action01 ?? '#246FE5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        fontWeight: 700,
        color: '#fff'
    },
    speakerName: {
        fontSize: 14,
        fontWeight: 500,
        maxWidth: '80%',
        textAlign: 'center' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
        color: '#fff'
    },

    // ── Overlay indicators ──
    overlayIndicators: {
        position: 'absolute' as const,
        bottom: 8,
        left: 8,
        display: 'flex',
        gap: 4
    },
    indicatorChip: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.55)',
        fontSize: 11,
        color: '#fff'
    },
    indicatorIcon: {
        display: 'inline-flex'
    },

    // ── Controls bar ──
    controls: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        backgroundColor: theme.palette.ui02 ?? '#292929',
        borderTop: `1px solid ${theme.palette.ui03 ?? '#444'}`
    },
    controlBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#fff',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.2)'
        },
        '&:focus-visible': {
            outline: '2px solid #fff'
        }
    },
    controlIcon: {
        display: 'inline-flex'
    },
    controlBtnActive: {
        backgroundColor: '#fff',
        color: '#1C2026'
    },
    controlBtnMuted: {
        backgroundColor: 'rgba(255,67,54,0.25)',
        color: '#FF4336'
    },
    hangupBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: '#FF4336',
        color: '#fff',
        '&:hover': {
            backgroundColor: '#D32F2F'
        }
    }
}));

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Returns initials for an avatar fallback.
 *
 * @param {string|undefined} name - Display name.
 * @returns {string} Up to 2 uppercase initials.
 */
function getInitials(name?: string): string {
    if (!name) {
        return '?';
    }

    return name.trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase())
        .join('') || '?';
}

// ── Main component ──────────────────────────────────────────────────

/**
 * Document PiP window content rendered via React portal.
 * Shows dominant speaker video + meeting controls.
 *
 * @returns {React.ReactElement | null}
 */
const DocPipWindow: React.FC = () => {
    const { classes } = useStyles();
    const dispatch: IStore['dispatch'] = useDispatch();

    // ── Redux selectors ──
    const isOpen = useSelector((state: IReduxState) => state['features/doc-pip']?.isOpen);
    const mode = useSelector((state: IReduxState) => state['features/doc-pip']?.mode);
    const conferenceName = useSelector(getConferenceName);
    const conferenceTimestamp = useSelector(getConferenceTimestamp);
    const participantCount = useSelector(getParticipantCountForDisplay);
    const largeVideoParticipant = useSelector(getLargeVideoParticipant);

    const {
        audioMuted,
        videoMuted,
        screenSharing,
        localRaisedHand
    } = useSelector((state: IReduxState) => ({
        audioMuted: isLocalTrackMuted(state['features/base/tracks'], MEDIA_TYPE.AUDIO),
        videoMuted: isLocalTrackMuted(state['features/base/tracks'], MEDIA_TYPE.VIDEO),
        screenSharing: isScreenVideoShared(state),
        localRaisedHand: hasRaisedHand(getLocalParticipant(state))
    }));

    // ── Dominant speaker stabilisation ──
    const [ stableParticipant, setStableParticipant ] = useState(largeVideoParticipant);
    const stabilizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (largeVideoParticipant?.id !== stableParticipant?.id) {
            if (stabilizeTimerRef.current) {
                clearTimeout(stabilizeTimerRef.current);
            }
            stabilizeTimerRef.current = setTimeout(() => {
                setStableParticipant(largeVideoParticipant);
                stabilizeTimerRef.current = null;
            }, DOMINANT_SPEAKER_HYSTERESIS_MS);
        }

        return () => {
            if (stabilizeTimerRef.current) {
                clearTimeout(stabilizeTimerRef.current);
            }
        };
    }, [ largeVideoParticipant?.id ]);

    // ── Video track for the displayed participant ──
    const videoTrack = useSelector((state: IReduxState) =>
        getVideoTrackByParticipant(state, stableParticipant));

    const displayName = useSelector((state: IReduxState) =>
        stableParticipant?.id
            ? getParticipantDisplayName(state, stableParticipant.id)
            : '');

    const shouldShowAvatar = !videoTrack
        || (videoTrack.muted && !videoTrack.local)
        || (!videoTrack.local && !isTrackStreamingStatusActive(videoTrack));

    // ── Portal container management ──
    const [ portalContainer, setPortalContainer ] = useState<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const previousTrackRef = useRef<any>(null);

    // Timer for elapsed conference time.
    const [ elapsed, setElapsed ] = useState('00:00');

    // Compact layout when the PiP window is resized below a width threshold.
    const [ isCompact, setIsCompact ] = useState(false);

    useEffect(() => {
        if (!conferenceTimestamp) {
            return;
        }

        const tick = () => setElapsed(formatDuration(Date.now() - conferenceTimestamp));

        tick();
        const id = setInterval(tick, 1000);

        return () => clearInterval(id);
    }, [ conferenceTimestamp ]);

    // ── Resize handling: adapt layout when the PiP window is resized ──
    useEffect(() => {
        if (!isOpen || mode !== 'doc') {
            return;
        }

        const pipWindow = DocPipManager.getWindow();

        if (!pipWindow) {
            return;
        }

        const COMPACT_WIDTH_THRESHOLD = 280;

        const onResize = () => {
            setIsCompact(pipWindow.innerWidth < COMPACT_WIDTH_THRESHOLD);
        };

        // Run immediately to set initial compact state.
        onResize();

        pipWindow.addEventListener('resize', onResize);

        return () => pipWindow.removeEventListener('resize', onResize);
    }, [ isOpen, mode ]);

    // Set up portal container when PiP opens.
    useEffect(() => {
        if (isOpen && mode === 'doc') {
            const pipWindow = DocPipManager.getWindow();

            if (!pipWindow || pipWindow.closed) {
                dispatch(closePip(true));

                return;
            }

            try {
                void pipWindow.document;
            } catch (err) {
                dispatch(closePip(true));

                return;
            }

            // Create mount point inside the PiP document.
            let container = pipWindow.document.getElementById('doc-pip-root') as HTMLDivElement | null;

            if (!container) {
                container = pipWindow.document.createElement('div');
                container.id = 'doc-pip-root';
                container.style.cssText = 'width:100%;height:100%;margin:0;padding:0;';
                pipWindow.document.body.style.margin = '0';
                pipWindow.document.body.style.overflow = 'hidden';
                pipWindow.document.body.appendChild(container);
            }


            setPortalContainer(container);

            // Forward keyboard events from PiP window → main window.
            const forwardEvent = (e: KeyboardEvent) => {
                try {
                    const syntheticEvent = new KeyboardEvent(e.type, {
                        key: e.key,
                        code: e.code,
                        keyCode: e.keyCode,
                        which: e.which,
                        altKey: e.altKey,
                        ctrlKey: e.ctrlKey,
                        metaKey: e.metaKey,
                        shiftKey: e.shiftKey,
                        bubbles: true,
                        cancelable: true
                    });

                    document.dispatchEvent(syntheticEvent);
                } catch (err) {
                    // Fallback for environments where KeyboardEvent construction is restricted.
                    window.postMessage({
                        type: 'DOC_PIP_KEY',
                        key: e.key,
                        eventType: e.type
                    }, '*');
                }
            };

            const onMessage = (event: MessageEvent) => {
                if (event.data?.type !== 'DOC_PIP_KEY') {
                    return;
                }

                const synthetic = new KeyboardEvent(event.data.eventType || 'keydown', {
                    key: event.data.key,
                    bubbles: true,
                    cancelable: true
                });

                document.dispatchEvent(synthetic);
            };

            pipWindow.document.addEventListener('keydown', forwardEvent);
            pipWindow.document.addEventListener('keyup', forwardEvent);
            window.addEventListener('message', onMessage);

            // Close PiP on main window navigation or hide.
            const onPopState = () => dispatch(closePip(true));
            const onPageHide = () => dispatch(closePip(true));

            window.addEventListener('popstate', onPopState);
            window.addEventListener('pagehide', onPageHide);

            return () => {
                pipWindow.document.removeEventListener('keydown', forwardEvent);
                pipWindow.document.removeEventListener('keyup', forwardEvent);
                window.removeEventListener('message', onMessage);
                window.removeEventListener('popstate', onPopState);
                window.removeEventListener('pagehide', onPageHide);

                try {
                    const root = pipWindow.document.getElementById('doc-pip-root');

                    if (root) {
                        root.remove();
                    }
                } catch (err) {
                    logger.warn('Error removing PiP root', err);
                }
                setPortalContainer(null);
            };
        }

        setPortalContainer(null);

        return undefined;
    }, [ isOpen, mode, dispatch ]);

    useEffect(() => {
        if (!isOpen || mode !== 'doc') {
            return;
        }

        const pipWindow = DocPipManager.getWindow();

        if (!pipWindow || pipWindow.closed) {
            return;
        }

        try {
            pipWindow.document.title = conferenceName || 'Jitsi PiP';
        } catch (err) {
            logger.warn('Error setting PiP title', err);
        }
    }, [ isOpen, mode, conferenceName ]);

    // ── Attach / detach video track to the <video> element inside the portal ──
    useEffect(() => {
        const videoElement = videoRef.current;

        if (!videoElement) {
            return;
        }

        // Detach previous.
        const prev = previousTrackRef.current;

        if (prev?.jitsiTrack && (prev !== videoTrack || shouldShowAvatar)) {
            try {
                prev.jitsiTrack.detach(videoElement);
            } catch (err) {
                logger.warn('Error detaching previous track', err);
            }
        }

        if (!shouldShowAvatar && videoTrack?.jitsiTrack && prev !== videoTrack) {
            videoTrack.jitsiTrack.attach(videoElement)
                .catch((err: Error) => logger.error('Error attaching video track:', err));
        }

        previousTrackRef.current = shouldShowAvatar ? null : videoTrack;

        return () => {
            if (videoTrack?.jitsiTrack && videoElement) {
                try {
                    videoTrack.jitsiTrack.detach(videoElement);
                } catch (err) {
                    logger.warn('Cleanup detach error', err);
                }
            }
        };
    }, [ videoTrack, shouldShowAvatar ]);

    // ── Action handlers ──
    const onToggleAudio = useCallback(() => {
        dispatch(muteLocal(!audioMuted, MEDIA_TYPE.AUDIO));
    }, [ dispatch, audioMuted ]);

    const onToggleVideo = useCallback(() => {
        dispatch(handleToggleVideoMuted(!videoMuted, true, true));
    }, [ dispatch, videoMuted ]);

    const onToggleScreenShare = useCallback(() => {
        dispatch(startScreenShareFlow(!screenSharing));
    }, [ dispatch, screenSharing ]);

    const onToggleRaiseHand = useCallback(() => {
        dispatch(raiseHand(!localRaisedHand));
    }, [ dispatch, localRaisedHand ]);

    const onOpenChat = useCallback(() => {
        // Close PiP first, then open chat in the main window.
        dispatch(closePip(false));
        dispatch(toggleChat());
    }, [ dispatch ]);

    const onHangup = useCallback(() => {
        dispatch(closePip(false));
        dispatch(leaveConference());
    }, [ dispatch ]);

    const onReturn = useCallback(() => {
        dispatch(closePip(true));
    }, [ dispatch ]);

    // ── Render nothing when DocPiP is not open ──
    if (!isOpen || mode !== 'doc' || !portalContainer) {
        return null;
    }

    // ── Portal content ──
    const content = (
        <div
            aria-label = 'Jitsi Picture in Picture meeting window'
            className = { classes.container }
            role = 'region'>
            <div
                aria-atomic = { true }
                aria-live = 'polite'
                style = {{ position: 'absolute', left: -9999 }}>
                { displayName || 'Participant' } is speaking
            </div>

            {/* ── Header ── */}
            <div className = { classes.header }>
                <div className = { classes.headerLeft }>
                    <div className = { classes.meetingTitle }>
                        { conferenceName || 'Jitsi Meeting' }
                    </div>
                    { !isCompact && (
                        <div className = { classes.metaRow }>
                            <span>⏱ { elapsed }</span>
                            <span>👥 { participantCount }</span>
                        </div>
                    ) }
                </div>
                <button
                    aria-label = 'Return to meeting'
                    className = { classes.returnButton }
                    onClick = { onReturn }
                    title = 'Return to meeting'
                    type = 'button'>
                    <span className = { classes.returnIcon }>
                        <Icon
                            size = { 14 }
                            src = { IconArrowUp } />
                    </span>
                    Return
                </button>
            </div>

            {/* ── Video / Avatar area ── */}
            <div className = { classes.videoArea }>
                { shouldShowAvatar ? (
                    <div className = { classes.avatarFallback }>
                        <div className = { classes.avatarCircle }>
                            { getInitials(displayName) }
                        </div>
                        <div className = { classes.speakerName }>
                            { displayName || 'Participant' }
                        </div>
                    </div>
                ) : (
                    <video
                        autoPlay = { true }
                        className = { classes.video }
                        muted = { true }
                        playsInline = { true }
                        ref = { videoRef } />
                ) }

                {/* Overlay indicators */}
                <div className = { classes.overlayIndicators }>
                    { screenSharing && (
                        <div className = { classes.indicatorChip }>
                            <span className = { classes.indicatorIcon }>
                                <Icon
                                    size = { 12 }
                                    src = { IconScreenshare } />
                            </span>
                            Screen sharing
                        </div>
                    ) }
                    { localRaisedHand && (
                        <div className = { classes.indicatorChip }>
                            <span className = { classes.indicatorIcon }>
                                <Icon
                                    size = { 12 }
                                    src = { IconRaiseHand } />
                            </span>
                            Hand raised
                        </div>
                    ) }
                </div>
            </div>

            {/* ── Controls bar ── */}
            <div className = { classes.controls }>
                <button
                    aria-label = { audioMuted ? 'Unmute microphone' : 'Mute microphone' }
                    className = { `${classes.controlBtn} ${audioMuted ? classes.controlBtnMuted : ''}` }
                    onClick = { onToggleAudio }
                    title = { audioMuted ? 'Unmute' : 'Mute' }
                    type = 'button'>
                    <span className = { classes.controlIcon }>
                        <Icon src = { audioMuted ? IconMicSlash : IconMic } />
                    </span>
                </button>
                <button
                    aria-label = { videoMuted ? 'Start camera' : 'Stop camera' }
                    className = { `${classes.controlBtn} ${videoMuted ? classes.controlBtnMuted : ''}` }
                    onClick = { onToggleVideo }
                    title = { videoMuted ? 'Start camera' : 'Stop camera' }
                    type = 'button'>
                    <span className = { classes.controlIcon }>
                        <Icon src = { videoMuted ? IconVideoOff : IconVideo } />
                    </span>
                </button>
                <button
                    aria-label = { screenSharing ? 'Stop sharing' : 'Share screen' }
                    className = { `${classes.controlBtn} ${screenSharing ? classes.controlBtnActive : ''}` }
                    onClick = { onToggleScreenShare }
                    title = { screenSharing ? 'Stop sharing' : 'Share screen' }
                    type = 'button'>
                    <span className = { classes.controlIcon }>
                        <Icon src = { IconScreenshare } />
                    </span>
                </button>
                <button
                    aria-label = { localRaisedHand ? 'Lower hand' : 'Raise hand' }
                    className = { `${classes.controlBtn} ${localRaisedHand ? classes.controlBtnActive : ''}` }
                    onClick = { onToggleRaiseHand }
                    title = { localRaisedHand ? 'Lower hand' : 'Raise hand' }
                    type = 'button'>
                    <span className = { classes.controlIcon }>
                        <Icon src = { IconRaiseHand } />
                    </span>
                </button>
                <button
                    aria-label = 'Open chat'
                    className = { classes.controlBtn }
                    onClick = { onOpenChat }
                    title = 'Chat'
                    type = 'button'>
                    <span className = { classes.controlIcon }>
                        <Icon src = { IconMessage } />
                    </span>
                </button>
                <button
                    aria-label = 'Leave meeting'
                    className = { classes.hangupBtn }
                    onClick = { onHangup }
                    title = 'Leave meeting'
                    type = 'button'>
                    <span className = { classes.controlIcon }>
                        <Icon src = { IconHangup } />
                    </span>
                </button>
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, portalContainer);
};

export default DocPipWindow;
