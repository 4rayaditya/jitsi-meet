import logger from './logger';
import {
    VIDEO_PIP_CLONE_ID,
    VIDEO_PIP_HOST_ID
} from './constants';

function _waitForLoadedMetadata(video: HTMLVideoElement): Promise<void> {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const onLoaded = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onError);
            resolve();
        };
        const onError = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onError);
            reject(new Error('Unable to load PiP video metadata'));
        };

        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
    });
}

function _findActiveVideoElement(): HTMLVideoElement | null {
    const selectors = [
        '#largeVideo video',
        '#largeVideoContainer video',
        '#pipVideo',
        'video#largeVideo',
        'video'
    ];

    for (const selector of selectors) {
        const candidate = document.querySelector(selector) as HTMLVideoElement | null;

        if (candidate?.srcObject || candidate?.src) {
            return candidate;
        }
    }

    return null;
}

class VideoPipManager {
    private _clonedVideo: HTMLVideoElement | null = null;

    private _host: HTMLDivElement | null = null;

    private _onLeave: (() => void) | null = null;

    enter = async () => {
        if (document.pictureInPictureElement) {
            return;
        }

        const sourceVideo = _findActiveVideoElement();

        if (!sourceVideo) {
            throw new Error('No active video element available for PiP fallback');
        }

        this._ensureHost();

        const clonedVideo = this._createOrUpdateClone(sourceVideo);

        await _waitForLoadedMetadata(clonedVideo);

        try {
            await clonedVideo.play();
        } catch (error) {
            (logger as any).warn('Video PiP clone autoplay failed, continuing with requestPictureInPicture', error);
        }

        if (!document.pictureInPictureElement) {
            await clonedVideo.requestPictureInPicture();
        }

        this._onLeave = () => {
            this.cleanup();
        };

        clonedVideo.addEventListener('leavepictureinpicture', this._onLeave, { once: true });
    };

    exit = async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        }

        this.cleanup();
    };

    cleanup = () => {
        if (this._clonedVideo && this._onLeave) {
            this._clonedVideo.removeEventListener('leavepictureinpicture', this._onLeave);
        }

        this._onLeave = null;

        if (this._clonedVideo?.parentElement) {
            this._clonedVideo.parentElement.removeChild(this._clonedVideo);
        }

        this._clonedVideo = null;

        if (this._host?.parentElement) {
            this._host.parentElement.removeChild(this._host);
        }

        this._host = null;
    };

    private _ensureHost() {
        if (this._host && document.body.contains(this._host)) {
            return;
        }

        const existing = document.getElementById(VIDEO_PIP_HOST_ID) as HTMLDivElement | null;

        if (existing) {
            this._host = existing;

            return;
        }

        const host = document.createElement('div');

        host.id = VIDEO_PIP_HOST_ID;
        host.style.position = 'fixed';
        host.style.width = '1px';
        host.style.height = '1px';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        host.style.left = '-9999px';
        host.style.top = '-9999px';

        document.body.appendChild(host);
        this._host = host;
    }

    private _createOrUpdateClone(sourceVideo: HTMLVideoElement) {
        if (!this._host) {
            throw new Error('PiP host container is not initialized');
        }

        if (!this._clonedVideo || !document.body.contains(this._clonedVideo)) {
            const existingClone = document.getElementById(VIDEO_PIP_CLONE_ID) as HTMLVideoElement | null;

            this._clonedVideo = existingClone ?? sourceVideo.cloneNode(false) as HTMLVideoElement;
            this._clonedVideo.id = VIDEO_PIP_CLONE_ID;
        }

        this._clonedVideo.srcObject = sourceVideo.srcObject;
        this._clonedVideo.src = sourceVideo.src;
        this._clonedVideo.muted = true;
        this._clonedVideo.autoplay = true;
        this._clonedVideo.playsInline = true;
        this._clonedVideo.controls = false;
        this._clonedVideo.disablePictureInPicture = false;

        if (!this._host.contains(this._clonedVideo)) {
            this._host.appendChild(this._clonedVideo);
        }

        return this._clonedVideo;
    }
}

export default new VideoPipManager();
