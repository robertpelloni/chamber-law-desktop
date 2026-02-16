const TOKEN_KEY = 'desktop_token';
const SIDEKICK_KEY = 'chamber_api_key';

async function secureStoreGet(key: string): Promise<string | null> {
  try {
    if (window.ipcRenderer?.invoke) {
      const value = await window.ipcRenderer.invoke('secure-store-get', key);
      return value || null;
    }
  } catch {
    // Fall back to localStorage.
  }

  return localStorage.getItem(key);
}

async function secureStoreSet(key: string, value: string): Promise<void> {
  try {
    if (window.ipcRenderer?.invoke) {
      await window.ipcRenderer.invoke('secure-store-set', key, value);
      return;
    }
  } catch {
    // Fall back to localStorage.
  }

  localStorage.setItem(key, value);
}

async function secureStoreDelete(key: string): Promise<void> {
  try {
    if (window.ipcRenderer?.invoke) {
      await window.ipcRenderer.invoke('secure-store-delete', key);
      return;
    }
  } catch {
    // Fall back to localStorage.
  }

  localStorage.removeItem(key);
}

export async function getDesktopToken(): Promise<string | null> {
  return secureStoreGet(TOKEN_KEY);
}

export async function setDesktopToken(token: string): Promise<void> {
  await secureStoreSet(TOKEN_KEY, token);
}

export async function clearDesktopToken(): Promise<void> {
  await secureStoreDelete(TOKEN_KEY);
}

export async function getSidekickToken(): Promise<string | null> {
  return secureStoreGet(SIDEKICK_KEY);
}

export async function setSidekickToken(token: string): Promise<void> {
  await secureStoreSet(SIDEKICK_KEY, token);
}

export async function clearSidekickToken(): Promise<void> {
  await secureStoreDelete(SIDEKICK_KEY);
}
