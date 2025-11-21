import { AnyAction, Dispatch, MiddlewareAPI } from 'redux';

import { APP_WILL_UNMOUNT } from '../base/app/actionTypes';
import { setAudioOnly } from '../base/audio-only/actions';
import { CONFERENCE_JOINED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import { JitsiConferenceEvents } from '../base/lib-jitsi-meet';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { showNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../notifications/constants';

// Configuration for Quality Levels
const LEVELS = {
    NORMAL: { maxHeight: 720, loss: 2, duration: 30000 },
    STANDARD: { maxHeight: 360, loss: 2, duration: 5000 },
    LOW: { maxHeight: 180, loss: 5, duration: 10000 },
    CRITICAL: { maxHeight: 0, loss: 15, duration: 10000 }
};

// State tracking (Module Level)
let currentLevelName = 'NORMAL';
let timers: { [key: string]: number | null } = {
    NORMAL: null,
    STANDARD: null,
    LOW: null,
    CRITICAL: null
};

// Keep track of the current conference to unsubscribe cleanly
let activeConference: any = null;

// Global APP type assertion for Jitsi API access
declare const window: Window & { APP: any };

/**
 * Helper: Robustly check for screenshare
 */
function isScreenshareActive(tracks: any[]): boolean {
    return Array.isArray(tracks) && tracks.some(t => t?.videoType === 'desktop');
}

/**
 * Implements the middleware for network adaptive mode.
 */
MiddlewareRegistry.register(({ dispatch, getState }: MiddlewareAPI) => (next: Dispatch) => (action: AnyAction) => {
    const result = next(action);

    switch (action.type) {
        case CONFERENCE_JOINED: {
            const { conference } = action;
            if (conference) {
                activeConference = conference;
                // Subscribe to the low-level event directly
                conference.on(
                    JitsiConferenceEvents.CONNECTION_QUALITY_CHANGED,
                    (quality: number, stats: any) => onQualityChanged({ dispatch, getState }, stats)
                );
            }
            break;
        }

        case CONFERENCE_LEFT:
        case APP_WILL_UNMOUNT: {
            // Clean up listeners
            if (activeConference) {
                activeConference.off(
                    JitsiConferenceEvents.CONNECTION_QUALITY_CHANGED,
                    onQualityChanged
                );
                activeConference = null;
            }
            resetMiddleware();
            break;
        }
    }

    return result;
});

/**
 * The Listener Function triggered by Jitsi's Event Emitter
 */
function onQualityChanged(store: { dispatch: any, getState: any }, stats: any) {
    const state = store.getState();
    const config = state['features/base/config'];

    // 1. Feature Flag Check
    if (config?.disableAdaptiveQuality) return;

    // 2. P2P Check
    // We should not run adaptive logic if we are in a Peer-to-Peer call
    const { p2p } = state['features/base/conference'];
    if (p2p) return;

    // 3. Get Packet Loss (Handle different Jitsi versions structure)
    const packetLoss = typeof stats?.packetLoss === 'number'
        ? stats.packetLoss
        : stats?.packetLoss?.total;

    if (typeof packetLoss !== 'number') return;

    // 4. User Override Check
    const settings = state['features/base/settings'];
    const { startAudioOnly } = settings || {};
    const preferredVideoQuality = state['features/video-quality']?.preferredVideoQuality;

    // If user manually set Audio Only or specifically requested Low Definition (180p), don't interfere
    if (startAudioOnly || preferredVideoQuality === 180) return;

    // 5. Screenshare Protection
    const tracks = state['features/base/tracks'] || [];
    if (isScreenshareActive(tracks)) return;

    // 6. Hysteresis Logic
    if (packetLoss > LEVELS.CRITICAL.loss) {
        scheduleChange(store, 'CRITICAL');
    } else if (packetLoss > LEVELS.LOW.loss) {
        scheduleChange(store, 'LOW');
    } else if (packetLoss > LEVELS.STANDARD.loss) {
        scheduleChange(store, 'STANDARD');
    } else {
        scheduleChange(store, 'NORMAL');
    }
}

/**
 * Schedules a level change after a duration (Hysteresis).
 */
function scheduleChange(store: { dispatch: any, getState: any }, targetLevel: string) {
    if (timers[targetLevel] !== null) return;

    // Clear all OTHER timers
    Object.keys(timers).forEach(level => {
        if (level !== targetLevel && timers[level] !== null) {
            window.clearTimeout(timers[level] as number);
            timers[level] = null;
        }
    });

    const duration = LEVELS[targetLevel as keyof typeof LEVELS].duration;

    timers[targetLevel] = window.setTimeout(() => {
        applyLevel(store, targetLevel);
        timers[targetLevel] = null;
    }, duration);
}

/**
 * Applies video constraints or audio-only mode.
 */
function applyLevel(store: { dispatch: any, getState: any }, levelName: string) {
    if (currentLevelName === levelName) return;

    currentLevelName = levelName;
    const conference = activeConference || window.APP?.conference;
    if (!conference) return;

    const config = LEVELS[levelName as keyof typeof LEVELS];

    if (levelName === 'CRITICAL') {
        store.dispatch(setAudioOnly(true));
        store.dispatch(showNotification({
            titleKey: 'Network Critical',
            descriptionKey: 'Switched to Audio-Only to preserve call quality.',
            uid: 'net_critical'
        }, NOTIFICATION_TIMEOUT_TYPE.SHORT));
    } else {
        // Restore Video if needed
        if (store.getState()['features/base/audio-only']?.enabled) {
            store.dispatch(setAudioOnly(false));
        }

        // Apply Receiver Constraints
        conference.setReceiverConstraints({
            defaultConstraints: { maxHeight: config.maxHeight }
        });

        // Notify only on significant drops
        if (levelName === 'LOW') {
            store.dispatch(showNotification({
                titleKey: 'Network Unstable',
                descriptionKey: 'Video quality reduced to Low to save bandwidth.',
                uid: 'net_low'
            }, NOTIFICATION_TIMEOUT_TYPE.SHORT));
        }
    }
}

/**
 * Cleanup
 */
function resetMiddleware() {
    Object.keys(timers).forEach(key => {
        if (timers[key]) window.clearTimeout(timers[key] as number);
        timers[key] = null;
    });
    currentLevelName = 'NORMAL';
}