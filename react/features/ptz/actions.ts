import {
    PTZ_CAPABILITIES_DETECTED,
    PTZ_RESET,
    PTZ_COMMAND_PENDING,
    PTZ_COMMAND_SUCCEEDED,
    PTZ_COMMAND_FAILED,
    PTZ_SET_PANEL_VISIBLE
} from './actionTypes';

export function ptzCapabilitiesDetected(deviceId: string, capabilities: any, currentValues?: any) {
    return { type: PTZ_CAPABILITIES_DETECTED, deviceId, capabilities, currentValues };
}
export function ptzReset() {
    return { type: PTZ_RESET };
}
export function ptzCommandPending() {
    return { type: PTZ_COMMAND_PENDING };
}
export function ptzCommandSucceeded(values: any) {
    return { type: PTZ_COMMAND_SUCCEEDED, values };
}
export function ptzCommandFailed(error: any) {
    return { type: PTZ_COMMAND_FAILED, error };
}

export function ptzSetPanelVisible(visible: boolean) {
    return { type: PTZ_SET_PANEL_VISIBLE, visible };
}