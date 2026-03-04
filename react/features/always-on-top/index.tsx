import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

import AlwaysOnTop from './AlwaysOnTop';

// Render the main/root Component.
const _rootEl = document.getElementById('react') ?? document.body;

if (!_rootEl._jitsiRoot) {
    _rootEl._jitsiRoot = createRoot(_rootEl);
}

_rootEl._jitsiRoot.render(<AlwaysOnTop />);

window.addEventListener('beforeunload', () => {
    if (_rootEl._jitsiRoot) {
        _rootEl._jitsiRoot.unmount();
    }
});
