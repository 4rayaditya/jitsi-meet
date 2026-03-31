import ReducerRegistry from '../base/redux/ReducerRegistry';
import {
    PTZ_CAPABILITIES_DETECTED,
    PTZ_RESET,
    PTZ_COMMAND_PENDING,
    PTZ_COMMAND_SUCCEEDED,
    PTZ_COMMAND_FAILED,
    PTZ_SET_PANEL_VISIBLE
} from './actionTypes';

export interface IPTZState {
    deviceId: string | null;
    capabilities: {
        pan?: { min: number; max: number; step: number; };
        tilt?: { min: number; max: number; step: number; };
        zoom?: { min: number; max: number; step: number; };
    } | null;
    currentValues: { pan?: number; tilt?: number; zoom?: number; };
    panelVisible: boolean;
    pending: boolean;
    error: any;
}

const DEFAULT_STATE: IPTZState = {
    deviceId: null,
    capabilities: null,
    currentValues: {},
    panelVisible: false,
    pending: false,
    error: null
};

ReducerRegistry.register('features/ptz', (state: IPTZState = DEFAULT_STATE, action: any) => {
    switch (action.type) {
        case PTZ_CAPABILITIES_DETECTED:
            return {
                ...state,
                deviceId: action.deviceId,
                capabilities: action.capabilities,
                currentValues: action.currentValues || state.currentValues
            };
        case PTZ_RESET:
            return DEFAULT_STATE;
        case PTZ_COMMAND_PENDING:
            return { ...state, pending: true, error: null };
        case PTZ_COMMAND_SUCCEEDED:
            return { ...state, pending: false, currentValues: { ...state.currentValues, ...action.values } };
        case PTZ_COMMAND_FAILED:
            return { ...state, pending: false, error: action.error };
        case PTZ_SET_PANEL_VISIBLE:
            return { ...state, panelVisible: Boolean(action.visible) };
        default:
            return state;
    }
});