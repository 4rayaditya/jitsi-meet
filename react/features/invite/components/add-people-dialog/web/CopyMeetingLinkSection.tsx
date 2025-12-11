import React from 'react';
import { useTranslation } from 'react-i18next';
import { makeStyles } from 'tss-react/mui';

import CopyButton from '../../../../base/buttons/CopyButton.web';
import { getDecodedURI } from '../../../../base/util/uri';


interface IProps {

    /**
     * Whether to enable jitsi-meet:// links.
     */
    enableJitsiLinks?: boolean;

    /**
     * The URL of the conference.
     */
    url: string;
}

const useStyles = makeStyles()(theme => {
    return {
        label: {
            display: 'block',
            marginBottom: theme.spacing(2)
        }
    };
});

/**
 * Component meant to enable users to copy the conference URL.
 *
 * @returns {React$Element<any>}
 */
function CopyMeetingLinkSection({ enableJitsiLinks, url }: IProps) {
    const { classes } = useStyles();
    const { t } = useTranslation();

    const roomName = url.split('/').pop();
    const jitsiLink = roomName ? `jitsi-meet://${roomName}` : '';

    return (
        <>
            <p className = { classes.label }>{t('addPeople.shareLink')}</p>
            <CopyButton
                accessibilityText = { t('addPeople.accessibilityLabel.meetingLink', { url: getDecodedURI(url) }) }
                className = 'invite-more-dialog-conference-url'
                displayedText = { getDecodedURI(url) }
                id = 'add-people-copy-link-button'
                textOnCopySuccess = { t('addPeople.linkCopied') }
                textOnHover = { t('addPeople.copyLink') }
                textToCopy = { url } />
            {enableJitsiLinks && jitsiLink && (
                <>
                    <p className = { classes.label } style = {{ marginTop: '16px' }}>{t('addPeople.desktopClientLink')}</p>
                    <CopyButton
                        accessibilityText = { t('addPeople.desktopClientLink') }
                        className = 'invite-more-dialog-desktop-url'
                        displayedText = { jitsiLink }
                        id = 'add-people-copy-desktop-link-button'
                        textOnCopySuccess = { t('addPeople.linkCopied') }
                        textOnHover = { t('addPeople.copyLink') }
                        textToCopy = { jitsiLink } />
                </>
            )}
        </>
    );
}

export default CopyMeetingLinkSection;
