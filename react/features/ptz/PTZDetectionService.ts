import { browser } from '../base/lib-jitsi-meet';

export class PTZDetectionService {
    static async detect(jitsiTrack: any) {
        if (!navigator.mediaDevices || !(navigator.mediaDevices as any).getSupportedConstraints) {
            return null;
        }

        const supported = (navigator.mediaDevices as any).getSupportedConstraints();
        const hasPTZSupport = Boolean(supported.pan || supported.tilt || supported.zoom);

        if ((browser.isFirefox() || browser.isSafari()) && !hasPTZSupport) {
            return null;
        }

        if (!hasPTZSupport) {
            return null;
        }

        const originalStream = jitsiTrack.getOriginalStream();
        if (!originalStream) return null;

        const tracks = originalStream.getVideoTracks();
        if (!tracks || tracks.length === 0) return null;

        const track = tracks[0];

        if (track.readyState !== 'live' || typeof track.getCapabilities !== 'function') {
            return null;
        }

        const delays = [0, 150, 300, 600];
        let capabilities: any = null;

        for (let i = 0; i < delays.length; i++) {
            capabilities = track.getCapabilities();
            if (capabilities.pan || capabilities.tilt || capabilities.zoom) {
                break; // Found PTZ
            }
            if (i < delays.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delays[i + 1]));
            }
        }

        if (!capabilities || (!capabilities.pan && !capabilities.tilt && !capabilities.zoom)) {
            return null;
        }

        const result: any = {};
        const currentValues: any = {};

        const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};

        const hasDegenerateRange = ['pan', 'tilt', 'zoom'].some(axis =>
            capabilities[axis] && capabilities[axis].min === capabilities[axis].max);

        if (hasDegenerateRange) {
            return null;
        }

        ['pan', 'tilt', 'zoom'].forEach(axis => {
            if (capabilities[axis]) {
                result[axis] = {
                    min: capabilities[axis].min,
                    max: capabilities[axis].max,
                    step: capabilities[axis].step || 1
                };
                if (settings[axis] !== undefined) {
                    currentValues[axis] = settings[axis];
                }
            }
        });

        if (Object.keys(result).length === 0) return null;

        return { capabilities: result, currentValues };
    }
}