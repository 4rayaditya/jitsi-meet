# DocPiP Proposal Snippets

This file contains copy-paste-ready code snippets for the major changes implemented. Use these in your GSoC proposal.

---

## React 18 migration — global entry point (`react/index.web.js`)

Description: replace deprecated `ReactDOM.render` with `createRoot`.

```javascript
import { createRoot } from 'react-dom/client';

globalNS.renderEntryPoint = ({ Component, props = {}, elementId = 'react' }) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!el._jitsiRoot) el._jitsiRoot = createRoot(el);
    el._jitsiRoot.render(<Component {...props} />);
};
```

---

## React 18 migration — dynamic container rendering (`modules/UI/videolayout/VideoContainer.js`)

Description: use `createRoot` for ad-hoc React renders.

```javascript
import { createRoot } from 'react-dom/client';

const container = document.getElementById('largeVideoBackgroundContainer');
if (container) {
    if (!container._jitsiRoot) container._jitsiRoot = createRoot(container);
    container._jitsiRoot.render(
        <LargeVideoBackground videoElement={this.video} videoTrack={this.stream} />
    );
}
```

---

## DocPiP actions — open PiP with DocPiP first, fallback to Video PiP (`react/features/doc-pip/actions.ts`)

Description: open DocPiP in user gesture, fallback to cloned video PiP.

```ts
export function openDocPip(triggerReason = 'manual') {
    return async (dispatch, getState) => {
        const mode = getBestPipMode();
        if (mode === 'doc') {
            try {
                await openDocPipWindow(); // must be called in user-gesture context
                dispatch(openDocPipAction('doc', triggerReason));
                return;
            } catch (e) { /* fall back */ }
        }
        if (mode === 'video') {
            await VideoPipManager.enter();
            dispatch(openDocPipAction('video', triggerReason));
        }
    };
}
```

---

## DocPiP reducer (`react/features/doc-pip/reducer.ts`)

Description: Redux state for PiP mode and auto-enabled flag.

```ts
const DEFAULT_STATE = { isOpen: false, mode: null, autoEnabled: true, lastTriggerReason: null };

ReducerRegistry.register('features/doc-pip', (state = DEFAULT_STATE, action) => {
    switch (action.type) {
    case OPEN_DOC_PIP:
        return { ...state, isOpen: true, mode: action.mode, lastTriggerReason: action.triggerReason ?? null };
    case CLOSE_DOC_PIP:
        return { ...state, isOpen: false, mode: null };
    default:
        return state;
    }
});
```

---

## DocPiP helpers — open document PiP and copy styles (`react/features/doc-pip/functions.ts`)

Description: request a `documentPictureInPicture` window and inject styles.

```ts
export async function openDocPipWindow(width = 420, height = 320): Promise<Window> {
    const apiWindow = window as any;
    if (!apiWindow.documentPictureInPicture?.requestWindow) {
        throw new Error('Document PiP not supported');
    }
    const pipWindow = await apiWindow.documentPictureInPicture.requestWindow({ width, height });
    copyStylesToDocument(pipWindow.document);
    pipWindow.document.body.style.margin = '0';
    currentDocPipWindow = pipWindow;
    return pipWindow;
}
```

---

## DocPiP UI portal & robust attach (`react/features/doc-pip/DocPipWindow.tsx`)

Description: portal into the opened DocPiP window and attach Jitsi video track safely.

```tsx
useEffect(() => {
    if (isOpen && mode === 'doc') {
        const win = getCurrentDocPipWindow();
        if (!win || win.closed) { dispatch(closeDocPipAction()); return; }
        let container = win.document.getElementById('doc-pip-root');
        if (!container) { container = win.document.createElement('div'); container.id = 'doc-pip-root'; win.document.body.appendChild(container); }
        setPortalContainer(container);
    } else { setPortalContainer(null); }
}, [isOpen, mode]);

useEffect(() => {
    if (!videoElement) return;
    previousTrackRef.current?.jitsiTrack?.detach?.(videoElement);
    if (track?.jitsiTrack && !shouldShowAvatar) track.jitsiTrack.attach(videoElement);
    previousTrackRef.current = track;
}, [track, videoElement, shouldShowAvatar]);

return portalContainer ? ReactDOM.createPortal(content, portalContainer) : null;
```

---

## Video PiP fallback manager (`react/features/doc-pip/VideoPipManager.ts`)

Description: clone active video element, wait metadata, call `requestPictureInPicture`.

```ts
async function _waitForLoadedMetadata(video: HTMLVideoElement) { /* ... */ }

async enter() {
    const source = _findActiveVideoElement();
    this._ensureHost();
    const cloned = this._createOrUpdateClone(source);
    await _waitForLoadedMetadata(cloned);
    try { await cloned.play(); } catch (e) { /* autoplay may fail */ }
    if (!document.pictureInPictureElement) await cloned.requestPictureInPicture();
}
```

---

## Auto PiP TriggerManager (scheduling) (`react/features/doc-pip/TriggerManager.ts`)

Description: listen to visibility/blur/focus and schedule auto PiP with flicker guard.

```ts
start() {
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('focus', this._onFocus);
}
private _scheduleRequest(reason) {
    this._clearPendingOpen();
    this._idleRequestId = requestIdle(() => {
        this._pendingOpenTimeout = window.setTimeout(() => {
            if (!this._options.isPipOpen()) this._options.onOpen(this._pendingReason);
        }, AUTO_PIP_TRIGGER_DELAY_MS);
    });
}
```

---

## Settings — enable auto-PiP (reducer + `MoreTab.tsx`)

Description: persist `autoPipEnabled` and add UI toggle.

Reducer default snippet:

```ts
const DEFAULT_STATE = { /* ... */, autoPipEnabled: true, /* ... */ };
```

MoreTab checkbox snippet:

```tsx
<Checkbox
    checked={autoPipEnabled}
    label='Enable Automatic Picture-in-Picture'
    onChange={({ target: { checked } }) => super._onChange({ autoPipEnabled: checked })} />
```

---

## Integration wiring (examples)

Add reducer and middleware imports:

```ts
// react/features/app/reducers.web.ts
import '../doc-pip/reducer';

// react/features/app/middlewares.web.ts
import '../doc-pip/middleware';
```

Add toolbox button hookup:

```ts
// react/features/toolbox/hooks.web.ts
import { useDocPipButton } from '../doc-pip/hooks.web';
const docPip = useDocPipButton();
// later in buttons map:
 'doc-pip': docPip
```

---

*File created automatically for proposal use.*
