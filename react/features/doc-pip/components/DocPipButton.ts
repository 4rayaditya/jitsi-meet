import { connect } from 'react-redux';

import { createToolbarEvent } from '../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../analytics/functions';
import { IReduxState } from '../../app/types';
import { translate } from '../../base/i18n/functions';
import { IconEnlarge, IconExitFullscreen } from '../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../base/toolbox/components/AbstractButton';
import { togglePip } from '../actions';
import { getBestPipMode } from '../functions';
import { TRIGGER_BUTTON } from '../types';

interface IProps extends AbstractButtonProps {

    /**
     * Whether the PiP window is currently open.
     */
    _isOpen: boolean;
}

/**
 * Toolbar button for toggling the Document Picture-in-Picture window.
 *
 * When PiP is open, clicking closes it.
 * When PiP is closed, clicking opens it using the best available mode.
 * Hidden when no PiP mode is supported.
 */
class DocPipButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.pip';
    override toggledAccessibilityLabel = 'toolbar.accessibilityLabel.exitPip';
    override label = 'toolbar.pip';
    override toggledLabel = 'toolbar.exitPip';
    override tooltip = 'toolbar.pip';
    override toggledTooltip = 'toolbar.exitPip';
    override icon = IconEnlarge;
    override toggledIcon = IconExitFullscreen;

    /**
     * Whether the button is in toggled (active) state.
     *
     * @override
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._isOpen;
    }

    /**
     * Handle click – toggle the PiP window.
     *
     * @override
     * @returns {void}
     */
    override _handleClick() {
        sendAnalytics(createToolbarEvent('toggle.pip', {
            enable: !this.props._isOpen
        }));
        this.props.dispatch(togglePip(TRIGGER_BUTTON));
    }
}

/**
 * Maps Redux state to component props.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {Object} Props derived from state.
 */
function mapStateToProps(state: IReduxState) {
    const { isOpen } = state['features/doc-pip'];

    return {
        _isOpen: isOpen,
        visible: getBestPipMode() !== null
    };
}

export default translate(connect(mapStateToProps)(DocPipButton));
