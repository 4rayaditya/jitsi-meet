import React from 'react';

interface Props {
    onStep: (panDelta: number, tiltDelta: number) => void;
    capabilities: any;
}

export function PTZArrowPad({ onStep, capabilities }: Props) {
    const hasPan = capabilities?.pan !== null && capabilities?.pan !== undefined;
    const hasTilt = capabilities?.tilt !== null && capabilities?.tilt !== undefined;

    if (!hasPan && !hasTilt) {
        return null;
    }

    const panStep = hasPan ? (capabilities.pan.step || 1) * 5 : 0;
    const tiltStep = hasTilt ? (capabilities.tilt.step || 1) * 5 : 0;

    const stopDrag = (e: React.SyntheticEvent) => e.stopPropagation();
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
            case 'ArrowUp':
                onStep(0, tiltStep);
                break;
            case 'ArrowDown':
                onStep(0, -tiltStep);
                break;
            case 'ArrowLeft':
                onStep(-panStep, 0);
                break;
            case 'ArrowRight':
                onStep(panStep, 0);
                break;
            case 'Enter':
            case ' ':
                onStep(0, 0);
                break;
            default:
                return;
        }

        e.preventDefault();
        e.stopPropagation();
    };

    const btnStyle = {
        background: '#333', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: '5px'
    };

    return (
        <div
            className="ptz-arrow-pad"
            onKeyDown={handleKeyDown}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 30px)', gridGap: '5px', justifyContent: 'center', marginTop: '10px' }}
            tabIndex={0}>
            <div />
            <button
                aria-label="Tilt Up"
                onClick={() => onStep(0, tiltStep)}
                onPointerDown={stopDrag}
                onMouseDown={stopDrag}
                onTouchStart={stopDrag}
                style={btnStyle}>U</button>
            <div />
            <button
                aria-label="Pan Left"
                onClick={() => onStep(-panStep, 0)}
                onPointerDown={stopDrag}
                onMouseDown={stopDrag}
                onTouchStart={stopDrag}
                style={btnStyle}>L</button>
            <button
                aria-label="Center"
                onClick={() => onStep(0, 0)}
                onPointerDown={stopDrag}
                onMouseDown={stopDrag}
                onTouchStart={stopDrag}
                style={{ ...btnStyle, background: '#555' }}>O</button>
            <button
                aria-label="Pan Right"
                onClick={() => onStep(panStep, 0)}
                onPointerDown={stopDrag}
                onMouseDown={stopDrag}
                onTouchStart={stopDrag}
                style={btnStyle}>R</button>
            <div />
            <button
                aria-label="Tilt Down"
                onClick={() => onStep(0, -tiltStep)}
                onPointerDown={stopDrag}
                onMouseDown={stopDrag}
                onTouchStart={stopDrag}
                style={btnStyle}>D</button>
            <div />
        </div>
    );
}

