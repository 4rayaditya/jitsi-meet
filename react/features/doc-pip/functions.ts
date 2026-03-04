import { IReduxState } from '../app/types';
import { isPrejoinPageVisible } from '../prejoin/functions.any';

import { DOC_PIP_DEFAULT_HEIGHT, DOC_PIP_DEFAULT_WIDTH } from './constants';
import logger from './logger';
import { DocPipMode, DocPipTriggerReason } from './types';

let currentDocPipWindow: Window | null = null;

interface IDocumentPictureInPictureWindow extends Window {
    documentPictureInPicture?: {
        requestWindow: (options: { width: number; height: number; }) => Promise<Window>;
    };
}

export function logDocPipEvent({
    action,
    mode,
    triggerReason
}: {
    action: 'opened' | 'closed' | 'failed' | 'triggered';
    mode?: DocPipMode;
    triggerReason?: DocPipTriggerReason;
}) {
    (logger as any).warn('doc-pip telemetry', {
        action,
        mode,
        triggerReason
    });
}

/**
 * Checks whether the Document Picture-in-Picture API is available.
 *
 * @returns {boolean} True if Document PiP is supported.
 */
export function supportsDocPip(): boolean {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

/**
 * Checks whether the standard Video Picture-in-Picture API is available and enabled.
 *
 * @returns {boolean} True if Video PiP is supported.
 */
export function supportsVideoPip(): boolean {
    return typeof document !== 'undefined'
        && 'pictureInPictureEnabled' in document
        && document.pictureInPictureEnabled === true;
}

/**
 * Determines the best PiP mode to use based on browser support.
 * Fallback priority: DocPiP → VideoPiP → null.
 *
 * @returns {'doc' | 'video' | null} The supported mode.
 */
export function getBestPipMode(): 'doc' | 'video' | null {
    if (supportsDocPip()) {
        return 'doc';
    }

    if (supportsVideoPip()) {
        return 'video';
    }

    return null;
}

/**
 * Returns whether conference is in a state where PiP can be opened.
 */
export function canOpenPipInCurrentState(state: IReduxState): boolean {
    const conference = state['features/base/conference']?.conference;

    if (!conference) {
        return false;
    }

    return !isPrejoinPageVisible(state);
}

/**
 * Copies stylesheets from the current document to a target document.
 * This ensures the DocPiP window has the same CSS as the main app.
 *
 * @param {Document} targetDoc - The target document (DocPiP window).
 * @returns {void}
 */
export function copyStylesToDocument(targetDoc: Document): void {
    // Copy adopted stylesheets (CSS-in-JS / tss-react).
    try {
        const adoptedSheets = [ ...document.adoptedStyleSheets ];

        if (adoptedSheets.length > 0) {
            targetDoc.adoptedStyleSheets = adoptedSheets;
        }
    } catch (e) {
        // noop
    }

    // Copy <style> and <link rel="stylesheet"> from <head>.
    const styleElements = document.querySelectorAll('style, link[rel="stylesheet"]');

    styleElements.forEach(el => {
        try {
            targetDoc.head.appendChild(el.cloneNode(true));
        } catch (e) {
            // noop
        }
    });
}

/**
 * Opens a Document Picture-in-Picture window.
 *
 * @param {number} width - The window width.
 * @param {number} height - The window height.
 * @returns {Promise<Window>} The PiP window.
 */
export async function openDocPipWindow(
        width = DOC_PIP_DEFAULT_WIDTH,
        height = DOC_PIP_DEFAULT_HEIGHT): Promise<Window> {
    const apiWindow = window as unknown as IDocumentPictureInPictureWindow;

    if (!apiWindow.documentPictureInPicture?.requestWindow) {
        throw new Error('Document Picture-in-Picture API not available');
    }

    const pipWindow: Window = await apiWindow.documentPictureInPicture.requestWindow({
        width,
        height
    });

    copyStylesToDocument(pipWindow.document);

    // Set a minimal body style to match Jitsi background.
    pipWindow.document.body.style.margin = '0';
    pipWindow.document.body.style.padding = '0';
    pipWindow.document.body.style.overflow = 'hidden';
    pipWindow.document.body.style.backgroundColor = 'transparent';

    currentDocPipWindow = pipWindow;

    return pipWindow;
}

/**
 * Returns the currently active Document PiP window if available.
 *
 * @returns {Window | null}
 */
export function getCurrentDocPipWindow(): Window | null {
    if (currentDocPipWindow?.closed) {
        currentDocPipWindow = null;
    }

    return currentDocPipWindow;
}

/**
 * Closes the current Document PiP window, if any.
 *
 * @returns {void}
 */
export function closeCurrentDocPipWindow(): void {
    if (currentDocPipWindow && !currentDocPipWindow.closed) {
        currentDocPipWindow.close();
    }

    currentDocPipWindow = null;
}
