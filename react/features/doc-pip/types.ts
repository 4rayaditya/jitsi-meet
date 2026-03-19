/**
 * State interface for the doc-pip feature.
 */
export interface IDocPipState {

    /**
     * Whether the DocPiP window is currently open.
     */
    isOpen: boolean;

    /**
     * The last reason that triggered PiP (e.g. 'button', 'tab-switch', 'shortcut').
     */
    lastTriggerReason: string | null;

    /**
     * The active PiP mode: 'doc' for Document PiP, 'video' for Video PiP, null if closed.
     */
    mode: 'doc' | 'video' | null;
}

/**
 * Trigger reasons for opening PiP.
 */
export const TRIGGER_BUTTON = 'button';
export const TRIGGER_TAB_SWITCH = 'tab-switch';
export const TRIGGER_SHORTCUT = 'shortcut';
