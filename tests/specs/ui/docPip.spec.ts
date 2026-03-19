import { Participant } from '../../helpers/Participant';
import { setTestProperties } from '../../helpers/TestProperties';
import { config as testsConfig } from '../../helpers/TestsConfig';
import { joinMuc } from '../../helpers/joinMuc';

setTestProperties(__filename, {
    usesBrowsers: [ 'p1' ]
});

describe('Doc PiP', () => {
    let p1: Participant;

    before('join the meeting', async () => {
        p1 = await joinMuc({ name: 'p1', token: testsConfig.jwt.preconfiguredToken });
    });

    it('shows the PiP button when supported', async function() {
        const supports = await p1.execute(() => {
            const hasDocPip = Boolean(window.documentPictureInPicture?.requestWindow);
            const hasVideoPip = Boolean(document.pictureInPictureEnabled);

            return {
                doc: hasDocPip,
                video: hasVideoPip
            };
        });

        if (!supports.doc && !supports.video) {
            this.skip();
        }

        await p1.getToolbar().waitForPipButton();
    });
});
