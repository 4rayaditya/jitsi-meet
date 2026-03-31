import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getLocalVideoPTZCapabilities } from '../functions';

export function PTZCapabilityBadge() {
    const { t } = useTranslation();
    const tracks = useSelector((state: any) => state['features/base/tracks']);
    const ptzState = useSelector((state: any) => state['features/ptz']);

    const capabilities = getLocalVideoPTZCapabilities(tracks, ptzState);
    if (!capabilities) {
        return null;
    }

    return (
        <span className="ptz-capability-badge" style={{ background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 5px', borderRadius: '3px', fontSize: '10px' }}>
            {t('ptz.badge')}
        </span>
    );
}