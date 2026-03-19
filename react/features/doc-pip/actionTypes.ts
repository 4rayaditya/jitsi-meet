/**
 * Action type to set the Document PiP window as open.
 *
 * {
 *     type: SET_DOC_PIP_OPEN,
 *     isOpen: boolean,
 *     mode: 'doc' | 'video' | null,
 *     reason: string | null
 * }
 */
export const SET_DOC_PIP_OPEN = 'SET_DOC_PIP_OPEN';

/**
 * Action type to close the Document PiP window.
 *
 * {
 *     type: CLOSE_DOC_PIP
 * }
 */
export const CLOSE_DOC_PIP = 'CLOSE_DOC_PIP';

/**
 * Blocks automatic PiP opening for a short period after the user explicitly
 * closed the PiP window. Payload contains `until` timestamp (ms since epoch).
 *
 * {
 *   type: BLOCK_DOC_PIP_AUTO_OPEN,
 *   until: number
 * }
 */
export const BLOCK_DOC_PIP_AUTO_OPEN = 'BLOCK_DOC_PIP_AUTO_OPEN';
