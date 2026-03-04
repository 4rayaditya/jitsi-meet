import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState, IStore } from '../../app/types';
import { leaveConference } from '../../base/conference/actions.any';
import { getConferenceName } from '../../base/conference/functions';
import { IconHangup, IconMic, IconMicSlash } from '../../base/icons/svg';
import Icon from '../../base/icons/components/Icon';
import { MEDIA_TYPE } from '../../base/media/constants';
import {
    getDominantSpeakerParticipant,
    getLocalParticipant,
    getParticipantDisplayName
} from '../../base/participants/functions';
import { isTrackStreamingStatusActive } from '../../connection-indicator/functions';
import { isLocalTrackMuted } from '../../base/tracks/functions.any';
import { getVideoTrackByParticipant } from '../../base/tracks/functions.any';
import { getLargeVideoParticipant } from '../../large-video/functions';
import { muteLocal } from '../../video-menu/actions.any';
import { closeDocPipAction } from '../actions';
import { getCurrentDocPipWindow } from '../functions';

const useStyles = makeStyles()(theme => {
    return {
        container: {
            display: 'flex',
            flexDirection: 'column' as const,
            width: '100%',
            height: '100%',
            backgroundColor: theme.palette.ui01,
            overflow: 'hidden',
            position: 'relative' as const,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },

        videoWrapper: {
            flex: 1,
            position: 'relative' as const,
            overflow: 'hidden',
            backgroundColor: theme.palette.ui02
        },

        video: {
            width: '100%',
            height: '100%',
            objectFit: 'cover' as const
        },

        avatarFallback: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.palette.ui02
        },

        avatarCircle: {
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: theme.palette.action01,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.palette.text01,
            fontSize: '32px',
            fontWeight: 'bold' as const
        },

        overlay: {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 2
        },

        meetingTitle: {
            color: theme.palette.text01,
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap' as const,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '200px'
        },

        displayName: {
            position: 'absolute' as const,
            bottom: '48px',
            left: 0,
            right: 0,
            textAlign: 'center' as const,
            color: theme.palette.text01,
            fontSize: '12px',
            fontWeight: 500,
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            zIndex: 2
        },

        controls: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: theme.palette.ui01,
            borderTop: `1px solid ${theme.palette.ui03}`
        },

        muteButton: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: theme.palette.action02,
            transition: 'background-color 0.2s',

            '&:hover': {
                backgroundColor: theme.palette.action02Hover
            },

            '& div > svg': {
                fill: theme.palette.icon01
            }
        },

        mutedButton: {
            backgroundColor: theme.palette.actionDanger,

            '&:hover': {
                backgroundColor: theme.palette.actionDangerHover
            }
        },

        leaveButton: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: theme.palette.actionDanger,
            transition: 'background-color 0.2s',

            '&:hover': {
                backgroundColor: theme.palette.actionDangerHover
            },

            '& div > svg': {
                fill: theme.palette.icon01
            }
        }
    };
});

/**
 * Component that manages the Document Picture-in-Picture window.
 * Renders into a DocPiP window using React Portal when isOpen is true.
 *
 * @returns {React.ReactElement | null}
 */
const DocPipWindow: React.FC = () => {
    const { classes, cx } = useStyles();
    const dispatch: IStore['dispatch'] = useDispatch();

    const isOpen = useSelector((state: IReduxState) => state['features/doc-pip']?.isOpen ?? false);
    const mode = useSelector((state: IReduxState) => state['features/doc-pip']?.mode ?? null);
    const conferenceName = useSelector(getConferenceName);
    const participant = useSelector((state: IReduxState) => {
        const dominantSpeaker = getDominantSpeakerParticipant(state);
        const largeVideoParticipant = getLargeVideoParticipant(state);
        const localParticipant = getLocalParticipant(state);
        const candidates = [ dominantSpeaker, largeVideoParticipant, localParticipant ].filter(Boolean);

        // Prefer a participant with an actually usable video track.
        const withTrack = candidates.find(candidate => {
            const track = getVideoTrackByParticipant(state, candidate);

            return track && !track.muted && (track.local || isTrackStreamingStatusActive(track));
        });

        return withTrack ?? candidates[0];
    });

    const videoTrack = useSelector((state: IReduxState) =>
        participant ? getVideoTrackByParticipant(state, participant) : undefined);

    const displayName = useSelector((state: IReduxState) =>
        participant?.id ? getParticipantDisplayName(state, participant.id) : ''
    );

    const audioMuted = useSelector((state: IReduxState) =>
        isLocalTrackMuted(state['features/base/tracks'], MEDIA_TYPE.AUDIO)
    );
    const shouldShowAvatar = !videoTrack
        || videoTrack.muted
        || (!videoTrack.local && !isTrackStreamingStatusActive(videoTrack));

    const [ pipWindow, setPipWindow ] = useState<Window | null>(null);
    const [ portalContainer, setPortalContainer ] = useState<HTMLDivElement | null>(null);
    const [ videoElement, setVideoElement ] = useState<HTMLVideoElement | null>(null);
    const previousTrackRef = React.useRef<any>(null);

    // Render into the already-opened DocPiP window.
    useEffect(() => {
        if (isOpen && mode === 'doc') {
            const win = getCurrentDocPipWindow();

            if (!win || win.closed) {
                dispatch(closeDocPipAction());

                return;
            }

            let container = win.document.getElementById('doc-pip-root') as HTMLDivElement | null;

            if (!container) {
                container = win.document.createElement('div');
                container.id = 'doc-pip-root';
                container.style.width = '100%';
                container.style.height = '100vh';
                win.document.body.appendChild(container);
            }

            const onPageHide = () => {
                dispatch(closeDocPipAction());
            };

            win.addEventListener('pagehide', onPageHide);
            setPipWindow(win);
            setPortalContainer(container);

            return () => {
                win.removeEventListener('pagehide', onPageHide);
            };
        }

        if (!isOpen && pipWindow) {
            setPipWindow(null);
            setPortalContainer(null);
        }

        return undefined;
    }, [ dispatch, isOpen, mode, pipWindow ]);

    // Attach/detach video track.
    useEffect(() => {
        if (!videoElement) {
            return;
        }

        const previousTrack = previousTrackRef.current;

        // Detach previous track.
        if (previousTrack?.jitsiTrack) {
            try {
                previousTrack.jitsiTrack.detach(videoElement);
            } catch (error) {
                // noop
            }
        }

        if (!shouldShowAvatar && videoTrack?.jitsiTrack) {
            try {
                videoTrack.jitsiTrack.attach(videoElement);
            } catch (error) {
                // noop
            }
        }

        previousTrackRef.current = videoTrack;

        return () => {
            if (videoTrack?.jitsiTrack && videoElement) {
                try {
                    videoTrack.jitsiTrack.detach(videoElement);
                } catch (error) {
                    // noop
                }
            }
        };
    }, [ shouldShowAvatar, videoElement, videoTrack, videoTrack?.muted ]);

    const onToggleMute = useCallback(() => {
        dispatch(muteLocal(!audioMuted, MEDIA_TYPE.AUDIO));
    }, [ dispatch, audioMuted ]);

    const onLeave = useCallback(() => {
        dispatch(leaveConference());
        dispatch(closeDocPipAction());
    }, [ dispatch ]);

    const initials = (participant?.name ?? '?').charAt(0).toUpperCase();

    // Only render portal when DocPiP window is open with a valid container.
    if (!isOpen || mode !== 'doc' || !portalContainer) {
        return null;
    }

    const content = (
        <div className = { classes.container }>
            <div className = { classes.videoWrapper }>
                { !shouldShowAvatar
                    ? (
                        <video
                            autoPlay = { true }
                            className = { classes.video }
                            muted = { true }
                            playsInline = { true }
                            ref = { setVideoElement } />
                    )
                    : (
                        <div className = { classes.avatarFallback }>
                            <div className = { classes.avatarCircle }>
                                { initials }
                            </div>
                        </div>
                    )
                }

                { /* Title overlay */ }
                <div className = { classes.overlay }>
                    <span className = { classes.meetingTitle }>
                        { conferenceName }
                    </span>
                </div>

                { /* Display name */ }
                { displayName && (
                    <div className = { classes.displayName }>
                        { displayName }
                    </div>
                )}
            </div>

            { /* Controls bar */ }
            <div className = { classes.controls }>
                <button
                    className = { cx(classes.muteButton, audioMuted && classes.mutedButton) }
                    onClick = { onToggleMute }
                    title = { audioMuted ? 'Unmute' : 'Mute' }>
                    <Icon
                        size = { 20 }
                        src = { audioMuted ? IconMicSlash : IconMic } />
                </button>

                <button
                    className = { classes.leaveButton }
                    onClick = { onLeave }
                    title = 'Leave meeting'>
                    <Icon
                        size = { 20 }
                        src = { IconHangup } />
                </button>
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, portalContainer);
};

export default DocPipWindow;
