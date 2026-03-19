declare module '*.svg' {
    const content: any;
    export default content;
}

declare module '*.svg?raw' {
    const content: string;
    export default content;
}

interface DocumentPictureInPictureOptions {
    height?: number;
    width?: number;
}

interface DocumentPictureInPicture {
    requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
}

interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
}
