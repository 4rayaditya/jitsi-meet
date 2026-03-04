/**
 * Action type to open the Document Picture-in-Picture window.
 *
 * {
 *     type: OPEN_DOC_PIP,
 *     mode: 'doc' | 'video'
 * }
 */
export const OPEN_DOC_PIP = 'OPEN_DOC_PIP';

/**
 * Action type to close the Document Picture-in-Picture window.
 *
 * {
 *     type: CLOSE_DOC_PIP
 * }
 */
export const CLOSE_DOC_PIP = 'CLOSE_DOC_PIP';

/**
 * Action type to set whether automatic Picture-in-Picture is enabled.
 */
export const SET_DOC_PIP_AUTO_ENABLED = 'SET_DOC_PIP_AUTO_ENABLED';

/**
 * Action type to reset the doc-pip feature state.
 */
export const RESET_DOC_PIP_STATE = 'RESET_DOC_PIP_STATE';
