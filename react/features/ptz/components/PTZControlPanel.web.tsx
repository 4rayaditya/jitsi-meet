import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Slider from '../../video-quality/components/Slider.web';
import { applyPTZConstraints } from '../../base/tracks/functions.web';
import { getLocalVideoPTZCapabilities } from '../functions';
import { ptzCommandPending, ptzCommandSucceeded, ptzCommandFailed } from '../actions';
import { PTZArrowPad } from './PTZArrowPad.web';

interface Props {
    commandService: any;
}

export function PTZControlPanel({ commandService }: Props) {
    const tracks = useSelector((state: any) => state['features/base/tracks']);
    const ptzState = useSelector((state: any) => state['features/ptz']);
    const dispatch = useDispatch();

    const isDemoMode = () => {
        if (typeof window === 'undefined') {
            return false;
        }
        const urlParams = new URLSearchParams(window.location.search);

        return Boolean((window as any).PTZ_DEMO) || urlParams.get('ptzDemo') === '1';
    };
    const demoMode = isDemoMode();

    const capabilities = useMemo(() => {
        const caps = getLocalVideoPTZCapabilities(tracks, ptzState);
        if (!caps && demoMode) {
            // Provide simulated capabilities for demo/testing without a physical PTZ camera.
            return {
                pan: { min: -30, max: 30, step: 1 },
                tilt: { min: -20, max: 20, step: 1 },
                zoom: { min: 1, max: 3, step: 0.1 }
            } as any;
        }

        return caps;
    }, [tracks, ptzState, demoMode]);

    const [dragOrigin, setDragOrigin] = useState<{ x: number, y: number } | null>(null);
    const [startValues, setStartValues] = useState<{ pan: number, tilt: number } | null>(null);
    const joystickRef = useRef<HTMLDivElement>(null);

    /**
     * Apply a visual PTZ simulation only to the main stage video.
     * This is purely a DOM/CSS effect for demo/testing and does not change any MediaStreamTrack.
     */
    const simulatePTZ = (values: any) => {
        try {
            // Target only the large-stage video so local self-view stays fixed.
            const wrapperCandidates = [
                document.querySelector('#largeVideoWrapper') as HTMLElement | null
            ].filter(Boolean) as HTMLElement[];

            const videoCandidates = [
                document.querySelector('#largeVideo') as HTMLVideoElement | null,
                document.querySelector('#largeVideoWrapper video') as HTMLVideoElement | null
            ].filter(Boolean) as HTMLVideoElement[];

            const wrapperEls = Array.from(new Set(wrapperCandidates));
            const videoEls = Array.from(new Set(videoCandidates));

            if (!videoEls.length && !wrapperEls.length) {
                return;
            }

            const stateHost = videoEls[0] || wrapperEls[0] || null;
            const prev = (stateHost?.dataset as any)?._ptz_prev
                ? JSON.parse((stateHost?.dataset as any)._ptz_prev)
                : { pan: 0, tilt: 0, zoom: 1 };
            const newVals = { ...prev, ...(values || {}) };

            const caps = capabilities || { pan: { min: -30, max: 30 }, tilt: { min: -20, max: 20 }, zoom: { min: 1, max: 3 } } as any;

            const panRange = (caps.pan?.max ?? 30) - (caps.pan?.min ?? -30);
            const tiltRange = (caps.tilt?.max ?? 20) - (caps.tilt?.min ?? -20);

            // Map pan/tilt into pixel translations (small demo values).
            const panRatio = ((newVals.pan - (caps.pan?.min ?? -30)) / Math.max(1, panRange)) - 0.5; // -0.5..0.5
            const tiltRatio = ((newVals.tilt - (caps.tilt?.min ?? -20)) / Math.max(1, tiltRange)) - 0.5;

            const maxTranslate = 18; // keep demo pan/tilt subtle on the main stage
            const tx = Math.round(panRatio * maxTranslate);
            const ty = Math.round(tiltRatio * maxTranslate);

            const rawZoom = typeof newVals.zoom === 'number' ? newVals.zoom : (prev.zoom || 1);
            // Compress zoom to avoid oversized face in demo mode.
            const zoom = Math.min(1.45, 1 + ((rawZoom - 1) * 0.35));

            // Apply transform and smooth transition.
            const transformValue = `translate(${tx}px, ${ty}px) scale(${zoom})`;

            wrapperEls.forEach(wrapperEl => {
                // Keep clipping local to wrappers and avoid moving overlay UI.
                wrapperEl.style.overflow = 'hidden';
                wrapperEl.style.transform = 'none';
            });

            videoEls.forEach(videoEl => {
                videoEl.style.transition = 'transform 220ms ease-out';
                videoEl.style.transformOrigin = '50% 50%';
                videoEl.style.transform = transformValue;
                videoEl.style.willChange = 'transform';
            });

            if (stateHost) {
                (stateHost.dataset as any)._ptz_prev = JSON.stringify(newVals);
            }
        } catch (err) {
            // noop
        }
    };

    const sendCommand = useCallback(async (values: any) => {
        dispatch(ptzCommandPending());
        try {
            if (isDemoMode()) {
                // Simulate PTZ visually on local video for testing without a real PTZ camera.
                simulatePTZ(values);
                dispatch(ptzCommandSucceeded(values));
            } else {
                await applyPTZConstraints(APP.store, commandService, values);
                dispatch(ptzCommandSucceeded(values));
            }
        } catch (e) {
            dispatch(ptzCommandFailed(e));
        }
    }, [commandService, dispatch, capabilities]);

    const currentPan = ptzState.currentValues?.pan || 0;
    const currentTilt = ptzState.currentValues?.tilt || 0;
    const currentZoom = ptzState.currentValues?.zoom || 1;
    const panelVisible = Boolean(ptzState.panelVisible);

    if (!capabilities || !panelVisible) {
        return null;
    }


    const panStep = (capabilities.pan !== null && capabilities.pan !== undefined) ? (capabilities.pan.step || 1) * 5 : 0;
    const tiltStep = (capabilities.tilt !== null && capabilities.tilt !== undefined) ? (capabilities.tilt.step || 1) * 5 : 0;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!joystickRef.current) return;
        joystickRef.current.setPointerCapture(e.pointerId);
        setDragOrigin({ x: e.clientX, y: e.clientY });
        setStartValues({ pan: currentPan, tilt: currentTilt });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragOrigin || !startValues) return;
        const deltaX = e.clientX - dragOrigin.x;
        const deltaY = e.clientY - dragOrigin.y;
        const newValues: any = {};
        if (capabilities.pan !== null && capabilities.pan !== undefined) {
            const panRange = capabilities.pan.max - capabilities.pan.min;
            const scaledDeltaX = (deltaX / 100) * panRange;
            newValues.pan = Math.max(capabilities.pan.min, Math.min(capabilities.pan.max, startValues.pan + scaledDeltaX));
        }
        if (capabilities.tilt !== null && capabilities.tilt !== undefined) {
            const tiltRange = capabilities.tilt.max - capabilities.tilt.min;
            const scaledDeltaY = -(deltaY / 100) * tiltRange;
            newValues.tilt = Math.max(capabilities.tilt.min, Math.min(capabilities.tilt.max, startValues.tilt + scaledDeltaY));
        }
        if (Object.keys(newValues).length > 0) {
            sendCommand(newValues);
        }
    };

    const handlePointerUp = () => {
        setDragOrigin(null);
        setStartValues(null);
    };

    const handleStep = (panDelta: number, tiltDelta: number) => {
        const newValues: any = {};
        if (panDelta !== 0 && capabilities.pan !== null && capabilities.pan !== undefined) {
            newValues.pan = currentPan + panDelta;
        }
        if (tiltDelta !== 0 && capabilities.tilt !== null && capabilities.tilt !== undefined) {
            newValues.tilt = currentTilt + tiltDelta;
        }
        if (Object.keys(newValues).length > 0) {
            sendCommand(newValues);
        }
    };

    const handleZoomChange = (e: any) => {
        const zoomVal = parseFloat(e.target.value);
        sendCommand({ zoom: zoomVal });
    };

    const stopDrag = (e: any) => e.stopPropagation();

    const cText = '#d9822b';
    const cBorder = '#8c5922';

    const btnStyle = {
        background: 'transparent',
        color: cText,
        border: '1px solid ' + cBorder,
        cursor: 'pointer',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none' as const,
        fontSize: '13px'
    };

    return (
        <div
            className="ptz-control-panel-new"
            onPointerDown={stopDrag}
            onMouseDown={stopDrag}
            onDragStart={(e) => e.preventDefault()}
            style={{
                position: 'fixed',
                bottom: '88px',
                right: '24px',
                background: '#12110c',
                padding: '12px',
                borderRadius: '4px',
                zIndex: 10000,
                pointerEvents: 'auto',
                border: '1px solid ' + cBorder,
                color: cText,
                fontFamily: 'sans-serif',
                minWidth: '270px',
                maxWidth: '300px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
            }}
        >
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>PTZ Controls</div>

            {(capabilities.pan !== null && capabilities.pan !== undefined || capabilities.tilt !== null && capabilities.tilt !== undefined) && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', marginBottom: '8px' }}>Pan / Tilt</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 84px)', gridTemplateRows: 'repeat(3, 30px)', gap: '0', justifyContent: 'center' }}>
                        <div />
                        <button onClick={() => handleStep(0, tiltStep)} style={{ ...btnStyle, borderBottom: 'none' }}>&#9650; Tilt up</button>
                        <div />

                        <button onClick={() => handleStep(-panStep, 0)} style={{ ...btnStyle, borderRight: 'none' }}>&#9664; Pan left</button>
                        <div
                            ref={joystickRef}
                            onPointerDown={(e) => { stopDrag(e); handlePointerDown(e); }}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            style={{
                                ...btnStyle,
                                background: dragOrigin ? '#261a0d' : '#141724',
                                border: '1px solid ' + cText,
                                opacity: 1
                            }}
                        >
                            &#9679; drag
                        </div>
                        <button onClick={() => handleStep(panStep, 0)} style={{ ...btnStyle, borderLeft: 'none' }}>Pan right &#9654;</button>

                        <div />
                        <button onClick={() => handleStep(0, -tiltStep)} style={{ ...btnStyle, borderTop: 'none' }}>&#9660; Tilt down</button>
                        <div />
                    </div>
                    <PTZArrowPad
                        capabilities={capabilities}
                        onStep={handleStep} />
                </div>
            )}

            {capabilities.zoom !== null && capabilities.zoom !== undefined && (
                <div>
                    <div style={{ fontSize: '13px', marginBottom: '8px' }}>Zoom</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px' }}>Wide &#9664;</span>
                        <div
                            onPointerDown={stopDrag}
                            onMouseDown={stopDrag}
                            onTouchStart={stopDrag}
                            style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '6px', height: '6px', background: cText, transform: 'rotate(45deg)' }}></div>
                            <Slider
                                ariaLabel="Zoom"
                                max={capabilities.zoom.max}
                                min={capabilities.zoom.min}
                                onChange={handleZoomChange}
                                step={capabilities.zoom.step}
                                value={currentZoom} />
                            <div style={{ width: '6px', height: '6px', background: cText, transform: 'rotate(45deg)' }}></div>
                        </div>
                        <span style={{ fontSize: '13px' }}>&#9654; Tele</span>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '14px', fontSize: '11px', fontStyle: 'italic', opacity: 0.6, color: '#a0a0a0' }}>
                On non-PTZ cameras: panel absent, badge absent, thumbnail unchanged.
            </div>
        </div>
    );
}

export default PTZControlPanel;




