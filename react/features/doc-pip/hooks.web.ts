import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { IReduxState } from '../app/types';
import { getParticipantById } from '../base/participants/functions';
import { getVideoTrackByParticipant } from '../base/tracks/functions.any';
import { getLargeVideoParticipant } from '../large-video/functions';

import { DOMINANT_SPEAKER_HYSTERESIS_MS } from './constants';
import { getBestPipMode, supportsDocPip } from './functions';

/**
 * Hook returning whether any PiP mode is available.
 *
 * @returns {boolean} True if at least one PiP mode is supported.
 */
export function useIsPipAvailable(): boolean {
    return getBestPipMode() !== null;
}

/**
 * Hook returning whether Document PiP is specifically available.
 *
 * @returns {boolean} True if the Document PiP API is available.
 */
export function useIsDocPipAvailable(): boolean {
    return supportsDocPip();
}

/**
 * Hook returning the current DocPiP Redux state.
 *
 * @returns {Object} The doc-pip slice state.
 */
export function useDocPipState() {
    return useSelector((state: IReduxState) => state['features/doc-pip']);
}

/**
 * Hook providing a stabilised dominant speaker for the PiP window.
 * Uses a hysteresis delay to prevent rapid speaker switching.
 *
 * @returns {Object} The stable participant and track.
 */
export function useStableDominantSpeaker() {
    const largeVideoParticipant = useSelector(getLargeVideoParticipant);
    const currentId = largeVideoParticipant?.id;

    const [ stableId, setStableId ] = useState<string | undefined>(currentId);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // If the dominant speaker changed, delay the switch.
        if (currentId !== stableId) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => {
                setStableId(currentId);
                timerRef.current = null;
            }, DOMINANT_SPEAKER_HYSTERESIS_MS);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [ currentId ]);

    const stableParticipant = useSelector((state: IReduxState) =>
        stableId ? getParticipantById(state, stableId) : undefined
    );

    const videoTrack = useSelector((state: IReduxState) =>
        getVideoTrackByParticipant(state, stableParticipant)
    );

    return {
        participant: stableParticipant,
        participantId: stableId,
        videoTrack
    };
}
