const LOCAL_API_FALLBACK = 'http://localhost:5100/api/v1';

function deriveDefaultApiBaseUrl(): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) {
    return envApi;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://api.chamberlaw.ai/api/v1';
    }
  }

  return LOCAL_API_FALLBACK;
}

function deriveSocketBaseUrl(apiBaseUrl: string): string {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitSocketUrl) {
    return explicitSocketUrl;
  }

  return apiBaseUrl.replace(/\/api\/v1\/?$/, '');
}

const apiBaseUrl = deriveDefaultApiBaseUrl();
const socketBaseUrl = deriveSocketBaseUrl(apiBaseUrl);

export const runtimeConfig = {
  apiBaseUrl,
  sidekickSocketUrl: `${socketBaseUrl}/sidekick`,
  socketReconnect: {
    attempts: Number(import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || 12),
    delayMs: Number(import.meta.env.VITE_SOCKET_RECONNECT_DELAY_MS || 1000),
    maxDelayMs: Number(import.meta.env.VITE_SOCKET_RECONNECT_MAX_DELAY_MS || 10000),
    timeoutMs: Number(import.meta.env.VITE_SOCKET_TIMEOUT_MS || 20000),
  },
};
