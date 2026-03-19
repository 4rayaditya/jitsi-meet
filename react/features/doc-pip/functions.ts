import { browser } from '../base/lib-jitsi-meet';

import { DOC_PIP_HEIGHT, DOC_PIP_WIDTH } from './constants';
import logger from './logger';

/**
 * Checks whether the current environment is Electron.
 *
 * @returns {boolean} True if running inside Electron.
 */
export function isElectronEnv(): boolean {
    return browser.isElectron();
}

/**
 * Checks whether the browser supports the Document Picture-in-Picture API.
 *
 * @returns {boolean} True if Document PiP is available.
 */
export function supportsDocPip(): boolean {
    return typeof window !== 'undefined'
        && 'documentPictureInPicture' in window
        && typeof (window as any).documentPictureInPicture?.requestWindow === 'function';
}

/**
 * Checks whether the browser supports the Video Picture-in-Picture API.
 *
 * @returns {boolean} True if Video PiP is available.
 */
export function supportsVideoPip(): boolean {
    return typeof document !== 'undefined'
        && 'pictureInPictureEnabled' in document
        && document.pictureInPictureEnabled === true;
}

/**
 * Returns the best PiP mode for the current environment.
 *
 * Decision logic:
 *   Electron        → 'video' (only thing that works in Electron)
 *   DocPiP capable  → 'doc'
 *   VideoPiP capable→ 'video'
 *   otherwise       → null.
 *
 * @returns {'doc' | 'video' | null} The recommended PiP mode.
 */
export function getBestPipMode(): 'doc' | 'video' | null {
    if (isElectronEnv()) {
        return 'video';
    }

    if (supportsDocPip()) {
        return 'doc';
    }

    if (supportsVideoPip()) {
        return 'video';
    }

    return null;
}

export interface IDocPipWindowResult {
    pipWindow: Window;
    stopStyleSync: () => void;
}

/**
 * Compute a responsive PiP window size based on the current viewport.
 * Uses `DOC_PIP_WIDTH`/`DOC_PIP_HEIGHT` aspect ratio as a baseline,
 * but scales to the viewport with sensible min/max limits so PiP is
 * usable on mobile, tablet and desktop.
 */
function computeDocPipSize(): { height: number; width: number; } {
    if (typeof window === 'undefined') {
        return { width: DOC_PIP_WIDTH, height: DOC_PIP_HEIGHT };
    }

    const viewportW = window.innerWidth || DOC_PIP_WIDTH;
    const viewportH = window.innerHeight || DOC_PIP_HEIGHT;

    const aspect = DOC_PIP_HEIGHT / DOC_PIP_WIDTH;

    // On very narrow viewports (phones) use most of the width.
    let width: number;

    if (viewportW < 480) {
        width = Math.round(viewportW * 0.9);
    } else {
        // For larger screens, pick a fraction but cap to reasonable sizes.
        width = Math.round(Math.min(Math.max(viewportW * 0.45, 320), 920));
    }

    // Ensure we don't exceed viewport height when computing height.
    let height = Math.round(width * aspect);
    const maxHeight = Math.round(viewportH * 0.9);

    if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(height / aspect);
    }

    return { width, height };
}

/**
 * Opens a Document Picture-in-Picture window and copies the parent page styles.
 *
 * @returns {Promise<IDocPipWindowResult>} The PiP window object and cleanup callback.
 */
export async function openDocPipWindow(): Promise<IDocPipWindowResult> {
    if (!('documentPictureInPicture' in window)) {
        throw new Error('Document PiP API unavailable');
    }

    const { width, height } = computeDocPipSize();

    const pipWindow: Window = await window.documentPictureInPicture!.requestWindow({
        width,
        height
    });

    // Copy and keep stylesheets in sync with the main document.
    const stopStyleSync = startStyleSync(document, pipWindow.document);

    return {
        pipWindow,
        stopStyleSync
    };
}

/**
 * Clones a single <link rel="stylesheet"> or <style> node into the target document.
 *
 * @param {Element} node - Source node to clone.
 * @param {Document} targetDoc - The target document to copy styles into.
 * @returns {void}
 */
function cloneStyleNode(node: Element, targetDoc: Document): void {
    if (!targetDoc.head) {
        return;
    }

    if (node.tagName === 'LINK') {
        const link = node as HTMLLinkElement;

        if (link.rel !== 'stylesheet' || !link.href) {
            return;
        }

        if (targetDoc.querySelector(`link[rel="stylesheet"][href="${link.href}"]`)) {
            return;
        }

        const newLink = targetDoc.createElement('link');

        newLink.rel = 'stylesheet';
        newLink.href = link.href;
        newLink.media = link.media;
        if (link.nonce) {
            newLink.nonce = link.nonce;
        }
        targetDoc.head.appendChild(newLink);

        return;
    }

    if (node.tagName === 'STYLE') {
        const style = node as HTMLStyleElement;
        const newStyle = targetDoc.createElement('style');

        if (style.media) {
            newStyle.media = style.media;
        }
        if (style.nonce) {
            newStyle.nonce = style.nonce;
        }
        newStyle.textContent = style.textContent;
        targetDoc.head.appendChild(newStyle);
    }
}

/**
 * Copies all stylesheets (both <link> and <style>) from the source document into the target document.
 *
 * @param {Document} sourceDoc - The source document to copy styles from.
 * @param {Document} targetDoc - The target document to copy styles into.
 * @returns {void}
 */
export function copyStyles(sourceDoc: Document, targetDoc: Document): void {
    if (!sourceDoc.head || !targetDoc.head) {
        return;
    }

    // Copy <link rel="stylesheet"> elements.
    const links = sourceDoc.querySelectorAll('link[rel="stylesheet"]');

    links.forEach(link => cloneStyleNode(link, targetDoc));

    // Copy <style> elements.
    const styles = sourceDoc.querySelectorAll('style');

    styles.forEach(style => cloneStyleNode(style, targetDoc));

    logger.debug('Copied styles from main document to PiP window');
}

/**
 * Keeps stylesheets in sync with the main document while the PiP window is open.
 *
 * @param {Document} sourceDoc - The source document to copy styles from.
 * @param {Document} targetDoc - The target document to copy styles into.
 * @returns {Function} Cleanup callback to stop observing.
 */
export function startStyleSync(sourceDoc: Document, targetDoc: Document): () => void {
    copyStyles(sourceDoc, targetDoc);

    if (!sourceDoc.head || !targetDoc.head) {
        logger.warn('Doc-PiP style sync skipped (missing document head)');

        return () => undefined;
    }

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }

                cloneStyleNode(node as Element, targetDoc);
            });
        });
    });

    observer.observe(sourceDoc.head, {
        childList: true,
        subtree: true
    });

    logger.debug('Doc-PiP style sync started');

    return () => observer.disconnect();
}

/**
 * Formats a duration in milliseconds to a MM:SS string.
 *
 * @param {number} ms - Duration in milliseconds.
 * @returns {string} Formatted time string.
 */
export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
