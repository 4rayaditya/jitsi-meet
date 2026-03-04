/**
 * The mode of the Document PiP feature.
 *
 * - 'doc' — Document Picture-in-Picture API (rich UI).
 * - 'video' — Standard HTMLVideoElement Picture-in-Picture (fallback).
 * - null — Not active.
 */
export type DocPipMode = 'doc' | 'video' | null;

/**
 * Reason for the last PiP trigger attempt.
 */
export type DocPipTriggerReason = 'tab' | 'blur' | 'minimize' | 'manual' | null;

/**
 * Redux state shape for the doc-pip feature.
 */
export interface IDocPipState {

    /**
     * Whether the PiP window (doc or video) is currently open.
     */
    isOpen: boolean;

    /**
     * Which PiP mode is currently active.
     */
    mode: DocPipMode;

    /**
     * Whether automatic PiP is enabled.
     */
    autoEnabled: boolean;

    /**
     * Last trigger reason used to open PiP.
     */
    lastTriggerReason: DocPipTriggerReason;
}
