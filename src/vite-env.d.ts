/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_SOCKET_URL?: string;
    readonly VITE_SOCKET_RECONNECT_ATTEMPTS?: string;
    readonly VITE_SOCKET_RECONNECT_DELAY_MS?: string;
    readonly VITE_SOCKET_RECONNECT_MAX_DELAY_MS?: string;
    readonly VITE_SOCKET_TIMEOUT_MS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface IElectronAPI {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    off: (channel: string, ...args: any[]) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
}

interface Window {
    ipcRenderer: IElectronAPI;
}
