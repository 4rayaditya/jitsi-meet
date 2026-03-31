export function getLocalVideoPTZCapabilities(tracks: any[], ptzState: any) {
    const localVideoTrack = tracks.find(t => t.local && t.mediaType === 'video');
    if (!localVideoTrack || !ptzState.capabilities) {
        return null;
    }
    // Cross-check if the current track deviceId matches the one we detected PTZ for.
    if (localVideoTrack.jitsiTrack) {
        const deviceId = localVideoTrack.jitsiTrack.getDeviceId();
        if (deviceId === ptzState.deviceId) {
            return ptzState.capabilities;
        }
    }
    return null;
}
