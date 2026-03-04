import DocPipButton from './components/DocPipButton';
import { getBestPipMode } from './functions';

const docPipButton = {
    key: 'doc-pip',
    Content: DocPipButton,
    group: 2
};

/**
 * Hook that returns the DocPiP toolbar button if any PiP mode is supported.
 * Returns undefined if neither Document PiP nor Video PiP is available.
 *
 * @returns {Object | undefined} The toolbar button definition.
 */
export function useDocPipButton() {
    if (getBestPipMode() !== null) {
        return docPipButton;
    }

    return undefined;
}
