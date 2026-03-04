import { APP_WILL_MOUNT } from '../base/app/actionTypes';
import {
	CONFERENCE_FAILED,
	CONFERENCE_JOINED,
	CONFERENCE_LEFT
} from '../base/conference/actionTypes';
import { CONNECTION_DISCONNECTED } from '../base/connection/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SETTINGS_UPDATED } from '../base/settings/actionTypes';
import { getLocalDesktopTrack } from '../base/tracks/functions.any';

import {
	closeDocPip,
	resetDocPipState,
	setAutoPipEnabledAction,
	tryAutoPip
} from './actions';
import { OPEN_DOC_PIP } from './actionTypes';
import { canOpenPipInCurrentState } from './functions';
import TriggerManager from './TriggerManager';

let triggerManager: TriggerManager | null = null;

function _isScreenSharingActive(state: any) {
	return Boolean(getLocalDesktopTrack(state['features/base/tracks'], true));
}

function _ensureTriggerManager(store: any) {
	if (triggerManager) {
		return;
	}

	triggerManager = new TriggerManager({
		isEnabled: () => {
			const state = store.getState();
			const docPipState = state['features/doc-pip'];

			return Boolean(docPipState?.autoEnabled)
				&& !docPipState?.isOpen
				&& canOpenPipInCurrentState(state);
		},
		isPipOpen: () => Boolean(store.getState()['features/doc-pip']?.isOpen),
		onOpen: reason => {
			store.dispatch(tryAutoPip(reason));
		},
		onClose: () => {
			store.dispatch(closeDocPip());
		}
	});

	triggerManager.start();
}

function _disposeTriggerManager() {
	if (!triggerManager) {
		return;
	}

	triggerManager.stop();
	triggerManager = null;
}

MiddlewareRegistry.register(store => next => action => {
	const prevState = store.getState();
	const prevScreenSharing = _isScreenSharingActive(prevState);
	const result = next(action);
	const state = store.getState();

	switch (action.type) {
	case APP_WILL_MOUNT:
		store.dispatch(setAutoPipEnabledAction(state['features/base/settings']?.autoPipEnabled !== false));
		break;

	case SETTINGS_UPDATED:
		if (Object.prototype.hasOwnProperty.call(action.settings ?? {}, 'autoPipEnabled')) {
			store.dispatch(setAutoPipEnabledAction(action.settings.autoPipEnabled !== false));
		}
		break;

	case CONFERENCE_JOINED:
		_ensureTriggerManager(store);
		break;

	case OPEN_DOC_PIP:
		triggerManager?.markOpened();
		break;

	case CONFERENCE_LEFT:
	case CONFERENCE_FAILED:
	case CONNECTION_DISCONNECTED:
		store.dispatch(closeDocPip());
		store.dispatch(resetDocPipState());
		_disposeTriggerManager();
		break;
	}

	const currentScreenSharing = _isScreenSharingActive(state);

	if (!prevScreenSharing
		&& currentScreenSharing
		&& !state['features/doc-pip']?.isOpen
		&& state['features/doc-pip']?.autoEnabled
		&& canOpenPipInCurrentState(state)
		&& (document.hidden || !document.hasFocus())) {
		store.dispatch(tryAutoPip('blur'));
	}

	return result;
});
