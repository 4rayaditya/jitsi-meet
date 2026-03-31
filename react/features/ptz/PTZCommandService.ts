export class PTZError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PTZError';
        Object.setPrototypeOf(this, PTZError.prototype);
    }
}

export class PTZCommandService {
    private jitsiTrack: any = null;
    private capabilities: any = null;
    private queue: Promise<any> = new Promise<void>(resolve => resolve());
    private timeoutId: any = null;
    private pendingValues: any = {};

    initialize(jitsiTrack: any, capabilities: any) {
        this.jitsiTrack = jitsiTrack;
        this.capabilities = capabilities;
    }

    isInitialized() {
        return this.jitsiTrack !== null;
    }

    teardown() {
        this.jitsiTrack = null;
        this.capabilities = null;
        this.pendingValues = {};
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    send(values: { pan?: number; tilt?: number; zoom?: number; }) {
        if (!this.isInitialized()) {
            return Promise.reject(new PTZError('NOT_INITIALIZED'));
        }

        this.pendingValues = { ...this.pendingValues, ...values };

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        return new Promise<void>((resolve, reject) => {
            this.timeoutId = setTimeout(() => {
                this.drain(resolve, reject);
            }, 50);
        });
    }

    private drain(resolve: () => void, reject: (reason?: any) => void) {
        const valuesToApply = { ...this.pendingValues };
        this.pendingValues = {};
        this.queue = this.queue
            .then(() => this.execute(valuesToApply))
            .then(resolve)
            .catch(reject);
    }

    private clamp(values: any): any {
        const clampedValues: any = {};

        if (!this.capabilities) {
            return clampedValues;
        }

        ['pan', 'tilt', 'zoom'].forEach(axis => {
            const cap = this.capabilities[axis];

            if (values[axis] === undefined || !cap) {
                return;
            }

            let val = values[axis];

            if (cap.step) {
                val = Math.round(val / cap.step) * cap.step;
            }

            val = Math.max(cap.min, Math.min(cap.max, val));
            val = Math.max(cap.min, Math.min(cap.max, val));

            clampedValues[axis] = val;
        });

        return clampedValues;
    }

    private isRetryable(err: any): boolean {
        return err.name === 'InvalidStateError' || err.name === 'NotReadableError';
    }

    private async execute(values: any, attempt: number = 0): Promise<void> {
        if (!this.isInitialized()) {
            throw new PTZError('NOT_INITIALIZED');
        }

        const originalStream = this.jitsiTrack.getOriginalStream();
        if (!originalStream) throw new PTZError('TRACK_NOT_READY');

        const tracks = originalStream.getVideoTracks();
        if (!tracks || tracks.length === 0) throw new PTZError('TRACK_NOT_READY');
        const track = tracks[0];

        for (let i = 0; i < 3; i++) {
            if (track.readyState === 'live') break;
            await new Promise(r => setTimeout(r, 150));
        }

        if (track.readyState !== 'live') throw new PTZError('TRACK_NOT_READY');

        if (document.visibilityState !== 'visible') {
            await new Promise<void>(resolve => {
                const listener = () => {
                    if (document.visibilityState === 'visible') {
                        document.removeEventListener('visibilitychange', listener);
                        resolve();
                    }
                };
                document.addEventListener('visibilitychange', listener);
            });
        }

        const clampedValues = this.clamp(values);

        if (Object.keys(clampedValues).length === 0) return;

        try {
            await track.applyConstraints({ advanced: [clampedValues] });
        } catch (err: any) {
            if (this.isRetryable(err)) {
                if (attempt >= 3) {
                    throw err;
                }
                await new Promise(r => setTimeout(r, 150 * Math.pow(2, attempt)));
                return this.execute(clampedValues, attempt + 1);
            }
            throw err;
        }
    }
}

export const ptzCommandService = new PTZCommandService();
