/**
 * PiP mode types used by the doc-pip feature.
 */
export const PIP_MODE_DOC = 'doc';
export const PIP_MODE_VIDEO = 'video';

/**
 * Default dimensions for the Document PiP window.
 */
export const DOC_PIP_WIDTH = 380;
export const DOC_PIP_HEIGHT = 540;

/**
 * Hysteresis delay (ms) for dominant speaker switching.
 * Prevents rapid switching between speakers.
 */
export const DOMINANT_SPEAKER_HYSTERESIS_MS = 2000;

/**
 * The redux store key for the doc-pip feature.
 */
export const STORE_NAME = 'features/doc-pip';
