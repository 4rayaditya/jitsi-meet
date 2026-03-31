import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import ContextMenuItem from '../../../base/ui/components/web/ContextMenuItem';
import { NOTIFY_CLICK_MODE } from '../../../toolbox/types';
import { ptzSetPanelVisible } from '../../../ptz/actions';
import { IButtonProps } from '../../types';

interface IProps extends IButtonProps {
    className?: string;
    onClick?: Function;
}

const PTZControlsButton = ({
    className,
    notifyClick,
    notifyMode,
    onClick
}: IProps): JSX.Element => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const panelVisible = useSelector((state: any) => Boolean(state['features/ptz']?.panelVisible));

    const _onClick = useCallback(() => {
        notifyClick?.();
        if (notifyMode === NOTIFY_CLICK_MODE.PREVENT_AND_NOTIFY) {
            return;
        }

        dispatch(ptzSetPanelVisible(!panelVisible));
        onClick?.();
    }, [ dispatch, notifyClick, notifyMode, onClick, panelVisible ]);

    return (
        <ContextMenuItem
            accessibilityLabel = { t(panelVisible ? 'ptz.hideControls' : 'ptz.openControls') }
            id = 'ptzControlsButton'
            onClick = { _onClick }
            text = { t(panelVisible ? 'ptz.hideControls' : 'ptz.openControls') }
            textClassName = { className } />
    );
};

export default PTZControlsButton;
