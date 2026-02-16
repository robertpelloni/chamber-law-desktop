
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { runtimeConfig } from './lib/runtimeConfig';
import { clearDesktopToken, getDesktopToken, setDesktopToken } from './lib/tokenStorage';
import {
  Activity,
  FileText,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  LogOut,
  Briefcase,
  FolderOpen,
  RefreshCw
} from 'lucide-react';

const API_URL = runtimeConfig.apiBaseUrl;
const SOCKET_URL = runtimeConfig.sidekickSocketUrl;

interface WatcherStatus {
  active: boolean;
  path: string;
  message: string;
  filters?: {
    extensions?: string[];
    ignoreHidden?: boolean;
  };
}

interface FileEvent {
  eventType: string;
  filename: string;
  timestamp: number;
}

interface PendingFileEvent extends FileEvent {
  id: string;
}

interface WatcherFilters {
  extensions: string[];
  ignoreHidden: boolean;
}

const PENDING_EVENTS_STORAGE_KEY = 'desktop_pending_events';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!'); // Default for dev speed
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Watcher State
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus>({ active: false, path: '', message: 'Initializing...' });
  const [recentEvents, setRecentEvents] = useState<FileEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingFileEvent[]>([]);
  const [watcherFilters, setWatcherFilters] = useState<WatcherFilters>({
    extensions: ['.pdf', '.doc', '.docx', '.txt'],
    ignoreHidden: true,
  });
  const [filterInput, setFilterInput] = useState('.pdf,.doc,.docx,.txt');
  const [savingFilters, setSavingFilters] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PENDING_EVENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PendingFileEvent[];
        setPendingEvents(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setPendingEvents([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PENDING_EVENTS_STORAGE_KEY, JSON.stringify(pendingEvents));
  }, [pendingEvents]);

  const enqueuePendingEvent = (event: FileEvent) => {
    const id = `${event.eventType}:${event.filename}`;
    setPendingEvents((prev) => {
      const withoutExisting = prev.filter((item) => item.id !== id);
      return [{ ...event, id }, ...withoutExisting].slice(0, 50);
    });
  };

  const flushPendingEvents = (socketInstance: Socket) => {
    if (!pendingEvents.length) return;

    pendingEvents.forEach((event) => {
      socketInstance.emit('file_change', {
        eventType: event.eventType,
        filename: event.filename,
        timestamp: event.timestamp,
        replayed: true,
      });
    });

    setStatus(`Replayed ${pendingEvents.length} queued file events`);
    setPendingEvents([]);
  };

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const storedToken = await getDesktopToken();
      if (mounted) {
        setToken(storedToken);
        setLoadingAuth(false);
      }
    }

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadWatcherFilters() {
      if (!window.ipcRenderer?.invoke) return;
      try {
        const filters = await window.ipcRenderer.invoke('watcher-get-filters');
        if (mounted && filters) {
          const normalized: WatcherFilters = {
            extensions: Array.isArray(filters.extensions) ? filters.extensions : [],
            ignoreHidden: Boolean(filters.ignoreHidden),
          };
          setWatcherFilters(normalized);
          setFilterInput((normalized.extensions || []).join(','));
        }
      } catch {
        // Keep local defaults.
      }
    }

    loadWatcherFilters();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-connect if token exists
  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
    return () => {
      socket?.disconnect();
    };
  }, [token]);

  // IPC Listeners
  useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.on('watcher-status', (_event, data: WatcherStatus) => {
        console.log("Watcher Status:", data);
        setWatcherStatus(data);
        // Relay to backend
        socket?.emit('watcher_status', data);
      });

      window.ipcRenderer.on('file-change', (_event, data: { eventType: string, filename: string }) => {
        console.log("File Change:", data);
        const newEvent = { ...data, timestamp: Date.now() };
        setRecentEvents(prev => [newEvent, ...prev].slice(0, 10)); // Keep last 10

        if (socket && isConnected) {
          socket.emit('file_change', newEvent);
        } else {
          enqueuePendingEvent(newEvent);
        }
      });
    }

    return () => {
      if (window.ipcRenderer) {
        // cleanup listeners if possible, though 'off' might need reference to function
      }
    }
  }, [socket, isConnected]);

  // Relay watcher status when socket connects
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('watcher_status', watcherStatus);
    }
  }, [socket, isConnected, watcherStatus]);


  const connectSocket = (authToken: string) => {
    const newSocket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: runtimeConfig.socketReconnect.attempts,
      reconnectionDelay: runtimeConfig.socketReconnect.delayMs,
      reconnectionDelayMax: runtimeConfig.socketReconnect.maxDelayMs,
      timeout: runtimeConfig.socketReconnect.timeoutMs,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setReconnectAttempts(0);
      setStatus('Connected to Sidekick Cloud');
      flushPendingEvents(newSocket);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setStatus('Disconnected. Attempting reconnect...');
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      setReconnectAttempts(attempt);
      setStatus(`Reconnecting... attempt ${attempt}/${runtimeConfig.socketReconnect.attempts}`);
    });

    newSocket.on('reconnect_failed', () => {
      setStatus('Reconnect failed. Please verify network and credentials.');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket Error:', err);
      setStatus(`Connection Error: ${err.message}`);
      if (err.message.includes('Authentication error')) {
        setToken(null);
        void clearDesktopToken();
      }
    });

    setSocket(newSocket);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Logging in...');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const accessToken = res.data.data.tokens?.accessToken || res.data.data.accessToken;
      if (accessToken) {
        setToken(accessToken);
        await setDesktopToken(accessToken);
        setStatus('Login Successful. Connecting...');
      } else {
        setStatus('Login Failed: No token received');
      }
    } catch (err: any) {
      console.error("Login Error", err);
      setStatus(`Login Failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleLogout = async () => {
    setToken(null);
    await clearDesktopToken();
    socket?.disconnect();
    setSocket(null);
    setIsConnected(false);
    setStatus('Logged out');
  };

  const handleReconnect = () => {
    if (socket) {
      socket.connect();
    } else if (token) {
      connectSocket(token);
    }
  };

  const handleSaveWatcherFilters = async () => {
    const parsedExtensions = filterInput
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .map((item) => (item.startsWith('.') ? item : `.${item}`));

    const nextFilters: WatcherFilters = {
      extensions: parsedExtensions,
      ignoreHidden: watcherFilters.ignoreHidden,
    };

    setSavingFilters(true);
    try {
      if (window.ipcRenderer?.invoke) {
        await window.ipcRenderer.invoke('watcher-set-filters', nextFilters);
      }
      setWatcherFilters(nextFilters);
      setStatus('Watcher filters updated');
    } catch (error: any) {
      setStatus(`Failed to update filters: ${error?.message || 'Unknown error'}`);
    } finally {
      setSavingFilters(false);
    }
  };

  const handleToggleIgnoreHidden = async () => {
    const nextFilters: WatcherFilters = {
      ...watcherFilters,
      ignoreHidden: !watcherFilters.ignoreHidden,
    };

    setSavingFilters(true);
    try {
      if (window.ipcRenderer?.invoke) {
        await window.ipcRenderer.invoke('watcher-set-filters', nextFilters);
      }
      setWatcherFilters(nextFilters);
      setStatus('Watcher filters updated');
    } catch (error: any) {
      setStatus(`Failed to update filters: ${error?.message || 'Unknown error'}`);
    } finally {
      setSavingFilters(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-300">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Initializing secure session...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Chamber.Law Sidekick</h1>
            <p className="text-zinc-400 mt-2 text-center">Secure Desktop Companion</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-zinc-300">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                placeholder="attorney@chamber.law"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-zinc-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              />
            </div>
            <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white transition-colors shadow-lg shadow-blue-900/20">
              Connect Sidekick
            </button>
            {status && (
              <div className={`p-3 rounded-lg text-sm text-center ${status.includes('Error') || status.includes('Failed') ? 'bg-red-900/20 text-red-200' : 'bg-zinc-800 text-zinc-300'}`}>
                {status}
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-bold text-lg">Sidekick</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800">BETA</span>
        </div>
        <button onClick={handleLogout} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cloud Connection */}
          <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">Cloud Link</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                <span className="text-xl font-semibold">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">{status}</p>
              {reconnectAttempts > 0 && (
                <p className="text-xs text-amber-400 mt-1">Reconnect attempts: {reconnectAttempts}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isConnected && (
                <button
                  onClick={handleReconnect}
                  className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                >
                  Reconnect
                </button>
              )}
              <div className={`p-3 rounded-full ${isConnected ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                {isConnected ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
              </div>
            </div>
          </div>

          {/* File Watcher */}
          <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 flex items-start justify-between shadow-sm">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">Local Watcher</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${watcherStatus.active ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-yellow-500'}`}></div>
                <span className="text-xl font-semibold">{watcherStatus.active ? 'Monitoring' : 'Initializing'}</span>
              </div>
              <p className="text-xs text-zinc-500 truncate" title={watcherStatus.path || 'Loading path...'}>
                {watcherStatus.path ? `Watching: ${watcherStatus.path}` : watcherStatus.message}
              </p>
            </div>
            <div className={`p-3 rounded-full ${watcherStatus.active ? 'bg-blue-900/20 text-blue-400' : 'bg-yellow-900/20 text-yellow-400'}`}>
              {watcherStatus.active ? <Eye className="h-6 w-6" /> : <EyeOff className="h-6 w-6" />}
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Activity Feed */}
          <div className="lg:col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold">Recent File Activity</h3>
              </div>
              <span className="text-xs text-zinc-500">{recentEvents.length} events</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">
              {recentEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3 opacity-60">
                  <FolderOpen className="h-10 w-10 mb-2" />
                  <p>No file changes detected yet.</p>
                  <p className="text-xs">Add or edit files in your monitored folder.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((event, i) => (
                    <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors group">
                      <div className="mt-1 p-2 bg-zinc-900 rounded-md group-hover:bg-blue-900/20 group-hover:text-blue-400 transition-colors">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-zinc-200 truncate">{event.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${event.eventType === 'change' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'
                            }`}>{event.eventType}</span>
                          <span className="text-xs text-zinc-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats / Info */}
          <div className="space-y-4">
            <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 mb-4 text-zinc-400">
                <Briefcase className="h-4 w-4" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Sync Stats</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Files Synced</span>
                  <span className="font-mono font-medium">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Pending Uploads</span>
                  <span className="font-mono font-medium">{pendingEvents.length}</span>
                </div>
                <div className="h-px bg-zinc-800 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Last Sync</span>
                  <span className="text-xs text-blue-400">Just now</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-900/30">
              <h4 className="font-medium text-blue-300 mb-2 text-sm">Pro Tip</h4>
              <p className="text-xs text-blue-200/70 leading-relaxed">
                Files saved in your monitored folder are automatically processed by the AI for relevant case matching.
              </p>
            </div>

            {pendingEvents.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-900/30 bg-amber-900/10">
                <h4 className="font-medium text-amber-300 mb-2 text-sm">Queued Offline Events</h4>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {pendingEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="text-xs text-amber-100/90 truncate">
                      {event.eventType.toUpperCase()} • {event.filename}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => socket && flushPendingEvents(socket)}
                  disabled={!socket || !isConnected}
                  className="mt-3 text-xs px-2 py-1 rounded bg-amber-800/40 text-amber-200 hover:bg-amber-800/60 disabled:opacity-40"
                >
                  Retry Queue Now
                </button>
              </div>
            )}

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
              <h4 className="font-medium text-zinc-200 text-sm">Watcher Scope Controls</h4>
              <p className="text-xs text-zinc-500">Comma-separated file extensions to monitor.</p>
              <input
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200"
                placeholder=".pdf,.docx,.txt"
              />
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={watcherFilters.ignoreHidden}
                  onChange={handleToggleIgnoreHidden}
                  disabled={savingFilters}
                />
                Ignore hidden files
              </label>
              <button
                onClick={handleSaveWatcherFilters}
                disabled={savingFilters}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40"
              >
                {savingFilters ? 'Saving...' : 'Apply Filters'}
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
