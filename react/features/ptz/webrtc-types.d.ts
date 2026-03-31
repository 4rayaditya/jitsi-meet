export {};

declare global {
    interface MediaTrackCapabilities {
        pan?: MediaSettingsRange;
        tilt?: MediaSettingsRange;
        zoom?: MediaSettingsRange;
    }

    interface MediaTrackConstraintSet {
        pan?: ConstrainDouble | boolean;
        tilt?: ConstrainDouble | boolean;
        zoom?: ConstrainDouble | boolean;
    }

    interface MediaTrackSettings {
        pan?: number;
        tilt?: number;
        zoom?: number;
    }
}
