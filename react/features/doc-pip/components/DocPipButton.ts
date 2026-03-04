import { connect } from 'react-redux';

import { IReduxState, IStore } from '../../app/types';
import { translate } from '../../base/i18n/functions';
import { IconEnlarge } from '../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../base/toolbox/components/AbstractButton';
import { openDocPip, closeDocPip } from '../actions';
import { getBestPipMode } from '../functions';

/**
 * Props for DocPipButton.
 */
interface IProps extends AbstractButtonProps {

    /**
     * Whether DocPiP is currently open.
     */
    _isOpen: boolean;
}

/**
 * Toolbar button to toggle Picture-in-Picture mode.
 * Uses Document PiP when available, falls back to Video PiP.
 */
class DocPipButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.pip';
    override toggledAccessibilityLabel = 'toolbar.accessibilityLabel.pip';
    override icon = IconEnlarge;
    override label = 'toolbar.openPiP';
    override toggledLabel = 'toolbar.closePiP';
    override tooltip = 'toolbar.pipToggle';

    /**
     * Handles button click.
     *
     * @override
     * @returns {void}
     */
    override _handleClick() {
        const { _isOpen, dispatch } = this.props;

        if (_isOpen) {
            dispatch(closeDocPip());
        } else {
            dispatch(openDocPip());
        }
    }

    /**
     * Returns whether the button is toggled (PiP is open).
     *
     * @override
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._isOpen;
    }
}

/**
 * Maps Redux state to component props.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {Object}
 */
function _mapStateToProps(state: IReduxState) {
    return {
        _isOpen: state['features/doc-pip']?.isOpen ?? false,
        visible: getBestPipMode() !== null
    };
}

export default translate(connect(_mapStateToProps)(DocPipButton));
