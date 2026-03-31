import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { TRACK_ADDED, TRACK_MUTE_CHANGED, TRACK_REMOVED } from '../base/tracks/actionTypes';
import { SET_VIDEO_INPUT_DEVICE } from '../base/devices/actionTypes';
import { getFeatureFlag } from '../base/flags/functions';
import { CAMERA_PTZ_ENABLED } from '../base/flags/constants';
import { ptzReset, ptzCapabilitiesDetected } from './actions';
import { PTZDetectionService } from './PTZDetectionService';
import { ptzCommandService } from './PTZCommandService';

MiddlewareRegistry.register((store: any) => (next: any) => async (action: any) => {
    const result = next(action);
    const state = store.getState();

    switch (action.type) {
        case TRACK_ADDED: {
            const { track } = action;
            if (track.local && track.mediaType === 'video' && track.videoType === 'camera') {
                if (!getFeatureFlag(state, CAMERA_PTZ_ENABLED, false)) {
                    break;
                }

                store.dispatch(ptzReset());
                const jitsiTrack = track.jitsiTrack;

                const detection = await PTZDetectionService.detect(jitsiTrack);
                if (detection) {
                    store.dispatch(ptzCapabilitiesDetected(
                        jitsiTrack.getDeviceId(),
                        detection.capabilities,
                        detection.currentValues
                    ));
                    ptzCommandService.initialize(jitsiTrack, detection.capabilities);
                }
            }
            break;
        }
        case TRACK_REMOVED: {
            const { track } = action;
            if (track.local && track.mediaType === 'video') {
                ptzCommandService.teardown();
                store.dispatch(ptzReset());
            }
            break;
        }
        case SET_VIDEO_INPUT_DEVICE: {
            store.dispatch(ptzReset());
            break;
        }
        case TRACK_MUTE_CHANGED: {
            const { track } = action;
            if (track.local && track.mediaType === 'video' && track.videoType === 'camera') {
                if (track.muted) {
                    break;
                }

                if (!getFeatureFlag(state, CAMERA_PTZ_ENABLED, false)) {
                    break;
                }

                const jitsiTrack = track.jitsiTrack;
                const detection = await PTZDetectionService.detect(jitsiTrack);
                if (detection) {
                    store.dispatch(ptzCapabilitiesDetected(
                        jitsiTrack.getDeviceId(),
                        detection.capabilities,
                        detection.currentValues
                    ));
                    ptzCommandService.initialize(jitsiTrack, detection.capabilities);

                    const ptzState = state['features/ptz'];
                    if (ptzState && ptzState.currentValues && ptzCommandService.isInitialized()) {
                        await ptzCommandService.send(ptzState.currentValues);
                    }
                } else {
                    ptzCommandService.teardown();
                    store.dispatch(ptzReset());
                }
            }
            break;
        }
    }

    return result;
});

