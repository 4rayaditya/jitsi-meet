import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState, IStore } from '../app/types';
import { leaveConference } from '../base/conference/actions.any';
import { getConferenceName } from '../base/conference/functions';
import Icon from '../base/icons/components/Icon';
import {
    IconDotsHorizontal,
    IconHangup,
    IconMic,
    IconMicSlash,
    IconRaiseHand,
    IconScreenshare,
    IconVideo,
    IconVideoOff,
    IconWifi1Bar,
    IconWifi2Bars,
    IconWifi3Bars
} from '../base/icons/svg';
import { MEDIA_TYPE, VIDEO_MUTISM_AUTHORITY } from '../base/media/constants';
import { setAudioMuted } from '../base/media/actions';
import {
    getDominantSpeakerParticipant,
    getLocalParticipant,
    getParticipantCountForDisplay,
    getParticipantDisplayName,
    hasRaisedHand,
    isScreenShareParticipant
} from '../base/participants/functions';
import { isTrackStreamingStatusActive, isTrackStreamingStatusInterrupted } from '../connection-indicator/functions';
import { getLocalDesktopTrack, getVideoTrackByParticipant, isLocalTrackMuted } from '../base/tracks/functions.any';
import Button from '../base/ui/components/web/Button';
import { BUTTON_TYPES } from '../base/ui/constants.web';
import { getLargeVideoParticipant } from '../large-video/functions';
import { handleToggleVideoMuted } from '../toolbox/actions.any';

import { closeDocPip, closeDocPipAction } from './actions';
import { SPEAKER_STABILIZATION_MS } from './constants';
import { getCurrentDocPipWindow } from './functions';

const useStyles = makeStyles()(theme => {
    return {
        container: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: theme.palette.ui01,
            color: theme.palette.text01,
            overflow: 'hidden'
        },

        tile: {
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: 0,
            backgroundColor: theme.palette.ui02,
            transition: 'all 180ms ease-in-out',
            overflow: 'hidden'
        },

        video: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 180ms ease-in-out'
        },

        avatarFallback: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },

        avatarCircle: {
            width: theme.spacing(16),
            height: theme.spacing(16),
            borderRadius: '50%',
            backgroundColor: theme.palette.action01,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.typography.heading4
        },

        topBar: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: theme.spacing(2),
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.52) 0%, rgba(0,0,0,0) 100%)'
        },

        title: {
            ...theme.typography.labelBold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },

        participantMeta: {
            position: 'absolute',
            left: theme.spacing(2),
            bottom: theme.spacing(2),
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(1),
            padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
            borderRadius: theme.shape.borderRadius,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            ...theme.typography.labelRegular
        },

        indicators: {
            position: 'absolute',
            right: theme.spacing(2),
            bottom: theme.spacing(2),
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(1)
        },

        indicatorChip: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: theme.spacing(5),
            height: theme.spacing(5),
            borderRadius: theme.shape.borderRadius,
            backgroundColor: 'rgba(0, 0, 0, 0.45)'
        },

        controls: {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: theme.spacing(1),
            padding: theme.spacing(2),
            backgroundColor: theme.palette.ui01,
            borderTop: `1px solid ${theme.palette.ui03}`,
            transition: 'all 150ms ease'
        },

        controlButton: {
            minHeight: theme.spacing(8)
        },

        dangerButton: {
            minHeight: theme.spacing(8)
        }
    };
});

function _getInitials(name?: string) {
    if (!name) {
        return '?';
    }

    const chunks = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

    return chunks.map(chunk => chunk[0]?.toUpperCase()).join('') || '?';
}

const DocPipWindow = () => {
    const { classes } = useStyles();
    const dispatch: IStore['dispatch'] = useDispatch();

    const { isOpen, mode } = useSelector((state: IReduxState) => state['features/doc-pip']);
    const conferenceName = useSelector(getConferenceName);
    const conference = useSelector((state: IReduxState) => state['features/base/conference'].conference);
    const isDisconnected = useSelector((state: IReduxState) => !state['features/base/conference'].conference
        && Boolean(state['features/base/connection']?.error));
    const participantCount = useSelector(getParticipantCountForDisplay);
    const localParticipant = useSelector(getLocalParticipant);
    const raisedHand = useSelector((state: IReduxState) => hasRaisedHand(getLocalParticipant(state)));
    const audioMuted = useSelector((state: IReduxState) =>
        isLocalTrackMuted(state['features/base/tracks'], MEDIA_TYPE.AUDIO));
    const videoMuted = useSelector((state: IReduxState) =>
        isLocalTrackMuted(state['features/base/tracks'], MEDIA_TYPE.VIDEO));

    const selection = useSelector((state: IReduxState) => {
        const dominantSpeaker = getDominantSpeakerParticipant(state);
        const largeVideoParticipant = getLargeVideoParticipant(state);
        const localDesktopTrack = getLocalDesktopTrack(state['features/base/tracks'], true);
        const hasLocalDesktopTrack = Boolean(localDesktopTrack && !localDesktopTrack.muted);

        if (hasLocalDesktopTrack) {
            return {
                isScreenShare: true,
                participant: localParticipant,
                track: localDesktopTrack
            };
        }

        if (largeVideoParticipant && isScreenShareParticipant(largeVideoParticipant)) {
            return {
                isScreenShare: true,
                participant: largeVideoParticipant,
                track: getVideoTrackByParticipant(state, largeVideoParticipant)
            };
        }

        const participant = dominantSpeaker || largeVideoParticipant || localParticipant;

        return {
            isScreenShare: false,
            participant,
            track: getVideoTrackByParticipant(state, participant)
        };
    });

    const [ stabilizedParticipant, setStabilizedParticipant ] = useState(selection.participant);
    const [ pipWindow, setPipWindow ] = useState<Window | null>(null);
    const [ portalContainer, setPortalContainer ] = useState<HTMLDivElement | null>(null);
    const [ videoElement, setVideoElement ] = useState<HTMLVideoElement | null>(null);

    const previousTrackRef = useRef<any>(null);
    const stabilizationTimeoutRef = useRef<number | null>(null);

    const displayParticipant = selection.isScreenShare ? selection.participant : stabilizedParticipant;

    const track = useSelector((state: IReduxState) => {
        if (selection.isScreenShare) {
            return selection.track;
        }

        return getVideoTrackByParticipant(state, displayParticipant);
    });

    const displayName = useSelector((state: IReduxState) =>
        displayParticipant ? getParticipantDisplayName(state, displayParticipant.id) : '');

    const shouldShowAvatar = !track
        || track.muted
        || (!track.local && !isTrackStreamingStatusActive(track));

    const networkIcon = useMemo(() => {
        if (!track || isTrackStreamingStatusInterrupted(track)) {
            return IconWifi1Bar;
        }

        if (!isTrackStreamingStatusActive(track)) {
            return IconWifi2Bars;
        }

        return IconWifi3Bars;
    }, [ track ]);

    useEffect(() => {
        if (selection.isScreenShare) {
            setStabilizedParticipant(selection.participant);

            return;
        }

        if (selection.participant?.id === stabilizedParticipant?.id) {
            return;
        }

        if (stabilizationTimeoutRef.current) {
            window.clearTimeout(stabilizationTimeoutRef.current);
        }

        stabilizationTimeoutRef.current = window.setTimeout(() => {
            setStabilizedParticipant(selection.participant);
            stabilizationTimeoutRef.current = null;
        }, SPEAKER_STABILIZATION_MS);

        return () => {
            if (stabilizationTimeoutRef.current) {
                window.clearTimeout(stabilizationTimeoutRef.current);
                stabilizationTimeoutRef.current = null;
            }
        };
    }, [ selection.isScreenShare, selection.participant, stabilizedParticipant?.id ]);

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
                container.style.height = '100%';
                win.document.body.appendChild(container);
            }

            const onPageHide = () => {
                dispatch(closeDocPip());
            };

            win.addEventListener('pagehide', onPageHide);
            setPipWindow(win);
            setPortalContainer(container);

            return () => {
                win.removeEventListener('pagehide', onPageHide);
            };
        }

        setPipWindow(null);
        setPortalContainer(null);

        return undefined;
    }, [ dispatch, isOpen, mode ]);

    useEffect(() => {
        if (!videoElement) {
            return;
        }

        const previousTrack = previousTrackRef.current;

        if (previousTrack?.jitsiTrack) {
            try {
                previousTrack.jitsiTrack.detach(videoElement);
            } catch (error) {
                // noop
            }
        }

        if (!shouldShowAvatar && track?.jitsiTrack) {
            try {
                track.jitsiTrack.attach(videoElement);
            } catch (error) {
                // noop
            }
        }

        previousTrackRef.current = track;

        return () => {
            if (track?.jitsiTrack && videoElement) {
                try {
                    track.jitsiTrack.detach(videoElement);
                } catch (error) {
                    // noop
                }
            }
        };
    }, [ track, shouldShowAvatar, videoElement ]);

    if (!isOpen || mode !== 'doc' || !portalContainer || !pipWindow) {
        return null;
    }

    const onToggleAudio = () => {
        dispatch(setAudioMuted(!audioMuted, true));
    };

    const onToggleVideo = () => {
        dispatch(handleToggleVideoMuted(!videoMuted, true, true));
    };

    const onLeave = () => {
        dispatch(leaveConference());
        dispatch(closeDocPip());
    };

    const onRejoin = () => {
        window.location.reload();
    };

    const content = (
        <div className = { classes.container }>
            <div className = { classes.tile }>
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
                                { _getInitials(displayName || localParticipant?.name) }
                            </div>
                        </div>
                    )
                }

                <div className = { classes.topBar }>
                    <span className = { classes.title }>
                        { conferenceName }
                    </span>
                    <div className = { classes.indicatorChip }>
                        <Icon
                            size = { 16 }
                            src = { IconDotsHorizontal } />
                    </div>
                </div>

                <div className = { classes.participantMeta }>
                    <span>{ displayName || localParticipant?.name || 'Meeting' }</span>
                    <span>•</span>
                    <span>{ participantCount }</span>
                </div>

                <div className = { classes.indicators }>
                    { selection.isScreenShare && (
                        <div className = { classes.indicatorChip }>
                            <Icon
                                size = { 16 }
                                src = { IconScreenshare } />
                        </div>
                    )}
                    { raisedHand && (
                        <div className = { classes.indicatorChip }>
                            <Icon
                                size = { 16 }
                                src = { IconRaiseHand } />
                        </div>
                    )}
                    <div className = { classes.indicatorChip }>
                        <Icon
                            size = { 16 }
                            src = { networkIcon } />
                    </div>
                </div>
            </div>

            <div className = { classes.controls }>
                <Button
                    accessibilityLabel = { audioMuted ? 'Unmute microphone' : 'Mute microphone' }
                    className = { classes.controlButton }
                    icon = { audioMuted ? IconMicSlash : IconMic }
                    onClick = { onToggleAudio }
                    type = { BUTTON_TYPES.SECONDARY } />
                <Button
                    accessibilityLabel = { videoMuted ? 'Turn camera on' : 'Turn camera off' }
                    className = { classes.controlButton }
                    icon = { videoMuted ? IconVideoOff : IconVideo }
                    onClick = { onToggleVideo }
                    type = { BUTTON_TYPES.SECONDARY } />
                <Button
                    accessibilityLabel = 'Leave meeting'
                    className = { classes.dangerButton }
                    icon = { IconHangup }
                    onClick = { onLeave }
                    type = { BUTTON_TYPES.DESTRUCTIVE } />
                <Button
                    accessibilityLabel = 'Rejoin meeting'
                    className = { classes.controlButton }
                    disabled = { !isDisconnected }
                    label = 'Rejoin'
                    onClick = { onRejoin }
                    type = { BUTTON_TYPES.PRIMARY } />
                <Button
                    accessibilityLabel = 'More actions'
                    className = { classes.controlButton }
                    icon = { IconDotsHorizontal }
                    onClick = { () => undefined }
                    type = { BUTTON_TYPES.TERTIARY } />
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, portalContainer);
};

export default DocPipWindow;
