/**
 * VideoPipManager – thin wrapper around the browser Video PiP API.
 *
 * Used as a fallback when Document PiP is not available,
 * or always in Electron because it is the only mode that works there.
 *
 * The existing {@code features/pip} code already handles Video PiP
 * lifecycle inside Electron (via MediaSession + PiPVideoElement).
 * This manager is used by the doc-pip feature to explicitly enter/exit
 * Video PiP on browsers that don't support Document PiP.
 */
import logger from './logger';

/**
 * Requests Video Picture-in-Picture from the existing #pipVideo element
 * (rendered by the pip feature's PiPVideoElement component).
 *
 * @returns {void}
 */
export function enterVideoPip(): void {
    const video = document.getElementById('pipVideo') as HTMLVideoElement | null;

    if (!video) {
        logger.error('enterVideoPip: #pipVideo element not found');

        return;
    }

    if (document.pictureInPictureElement) {
        logger.warn('enterVideoPip: already in Video PiP');

        return;
    }

    if (video.readyState < 1) {
        logger.warn('enterVideoPip: video metadata not loaded, waiting…');
        video.addEventListener('loadedmetadata', () => {
            _requestPip(video);
        }, { once: true });

        return;
    }

    _requestPip(video);
}

/**
 * Exits Video Picture-in-Picture if active.
 *
 * @returns {void}
 */
export function exitVideoPip(): void {
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture()
            .then(() => logger.debug('exitVideoPip: exited'))
            .catch((err: Error) => logger.error('exitVideoPip: error:', err.message));
    }
}

/**
 * Internal helper – call requestPictureInPicture on a video element.
 *
 * @param {HTMLVideoElement} video - The video element.
 * @returns {void}
 */
function _requestPip(video: HTMLVideoElement): void {
    // @ts-ignore – requestPictureInPicture types may not be present.
    video.requestPictureInPicture()
        .then(() => logger.debug('enterVideoPip: entered'))
        .catch((err: Error) => logger.error('enterVideoPip: error:', err.message));
}
