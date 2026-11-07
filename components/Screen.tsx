
import React, { useEffect, useState, Component } from 'react';
import { Player } from './Player';
import { Device } from '../types';
import { server, safeStorage } from '../services/server';
import Cast from 'lucide-react/dist/esm/icons/cast';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Monitor from 'lucide-react/dist/esm/icons/monitor';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off';
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw';
import Settings from 'lucide-react/dist/esm/icons/settings';

interface ScreenProps {
    onExit: () => void;
}

import { ErrorBoundary } from './ErrorBoundary';

export const Screen: React.FC<ScreenProps> = ({ onExit }) => {
    // Initialize Device ID synchronously to ensure it never changes during component lifecycle
    // 1. Check URL parameters (?tvId=...)
    // 2. Check localStorage/cookies
    // 3. Generate new ID if not found
    const [deviceId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('previewCampaign')) {
            return 'preview';
        }
        let id = params.get('tvId') || params.get('screen');
        
        if (!id) {
            id = safeStorage.getItem('storecast_device_id');
        }
        
        if (!id) {
            id = Math.random().toString(36).substring(2, 10);
        }
        
        // Always ensure storage has it
        safeStorage.setItem('storecast_device_id', id);
        return id;
    });

    const [previewCampaignId] = useState(() => new URLSearchParams(window.location.search).get('previewCampaign'));
    const [overrideRotation] = useState(() => {
        const val = new URLSearchParams(window.location.search).get('overrideRotation');
        return val !== null ? parseInt(val, 10) : null;
    });
    const [previewCampaign, setPreviewCampaign] = useState<any>(null);

    const [device, setDevice] = useState<Device | null>(null);
    const [error, setError] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [customUrl, setCustomUrl] = useState(server.getServerUrl());
    const [showConfig, setShowConfig] = useState(false);

    // Instant Cache Hydration: Read cached device payload from storage immediately on boot
    useEffect(() => {
        if (!device && !previewCampaignId) {
            const cacheKey = `storecast_cached_device_${deviceId}`;
            const cachedStr = safeStorage.getItem(cacheKey);
            if (cachedStr) {
                if (cachedStr.includes('data:video/')) {
                    console.log("[Screen] Purging legacy base64 cache from storage to save memory...");
                    safeStorage.removeItem(cacheKey);
                    return;
                }
                try {
                    const cachedDev = JSON.parse(cachedStr);
                    console.log("[Screen] Instant boot from local cache while background-syncing with server...");
                    setDevice(cachedDev);
                } catch (e) {}
            }
        }
    }, [deviceId, previewCampaignId]);

    // Initialize and Connect
    useEffect(() => {
        if (previewCampaignId) {
            const loadPreview = async () => {
                const c = await server.fetchPreviewCampaign(previewCampaignId);
                if (c) {
                    setPreviewCampaign(c);
                    setError(false);
                } else {
                    console.error("[Screen] Failed to load preview campaign:", previewCampaignId);
                    setError(true);
                }
            };
            loadPreview();
            return;
        }

        const triggerSafeReload = (reason: string) => {
            const now = Date.now();
            const lastReload = parseInt(safeStorage.getItem('storecast_last_reload_timestamp') || '0');
            if (now - lastReload < 30000) {
                console.warn(`[Screen] Shielding against rapid reload loop (<30s since last reload). Reason: ${reason}`);
                return;
            }
            safeStorage.setItem('storecast_last_reload_timestamp', now.toString());
            console.log(`[Screen] Triggering reload in 1000ms. Reason: ${reason}`);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };

        const init = async () => {
            try {
                // Always try to reset error state on init attempt
                if (isRetrying) {
                    setError(false);
                }

                const screenW = window.screen?.width || window.innerWidth;
                const screenH = window.screen?.height || window.innerHeight;
                const resolution = `${screenW}x${screenH}`;
                const userAgent = navigator.userAgent;
                const dev = await server.initDevice(deviceId, resolution, userAgent);
                console.log(`[Screen] Device loaded: id=${dev?.id} registered=${dev?.isRegistered} resolution=${resolution} playlist=${dev?.playlist?.length} items`);
                
                if (dev?.lastReloadTime) {
                    // Seed initial lastReloadTime on boot so it is marked as already processed
                    safeStorage.setItem('storecast_last_reload_time', dev.lastReloadTime.toString());
                }

                setDevice(dev);
                setError(false); // Valid init, clear error
            } catch (e) {
                console.error("Initialization failed", e);
                // Only show error screen if we don't have a cached device state
                if (!device) {
                    setError(true);
                }
            } finally {
                setIsRetrying(false);
            }
        };

        init();

        // Subscribe to server updates (real-time push)
        const unsubscribe = server.subscribe((data: any) => {
            // Handle special signals first
            if (data?.type === 'RELOAD') {
                const signalId = data.id || 'manual';
                const lastReloadId = safeStorage.getItem('storecast_last_reload_id');
                
                if (lastReloadId === signalId) {
                    console.log(`[Screen] Shielding redundant RELOAD signal (ID: ${signalId})`);
                    return;
                }
                
                safeStorage.setItem('storecast_last_reload_id', signalId);
                triggerSafeReload(`WebSocket RELOAD signal (ID: ${signalId})`);
                return;
            }

            if (data?.type === 'PLAY_NOW') {
                console.log(`[Screen] Received PLAY_NOW for asset: ${data.assetId}`);
                window.dispatchEvent(new CustomEvent('storecast_play_now', { detail: data.assetId }));
                return;
            }
            
            // Handle polling-based RELOAD signal from device state
            if (data?.lastReloadTime) {
                const serverReloadTime = data.lastReloadTime;
                const lastLocalReload = parseInt(safeStorage.getItem('storecast_last_reload_time') || '0');
                
                if (lastLocalReload === 0) {
                    safeStorage.setItem('storecast_last_reload_time', serverReloadTime.toString());
                } else if (serverReloadTime > lastLocalReload) {
                    safeStorage.setItem('storecast_last_reload_time', serverReloadTime.toString());
                    triggerSafeReload(`Polling RELOAD signal (Server: ${serverReloadTime}, Local: ${lastLocalReload})`);
                    return;
                }
            }
            // Try to update device if we got a device object directly
            if (data && data.id && data.playlist !== undefined) {
                setDevice(current => {
                    if (current) {
                        // Deep compare critical fields to ignore ephemeral state like 'lastSeen'
                        // and prevent unecessary re-renders during logging/heartbeats.
                        const isSame = 
                            current.id === data.id &&
                            current.isRegistered === data.isRegistered &&
                            current.rotation === data.rotation &&
                            current.overlay === data.overlay &&
                            current.groupId === data.groupId &&
                            current.playlistHash === data.playlistHash;

                        if (isSame) return current;
                    }
                    return data;
                });
            }
        });

        return unsubscribe;
    }, [isRetrying, deviceId, previewCampaignId]);

    // Background Auto-Retry for High-Latency / Intermittent Connections
    useEffect(() => {
        let timer: any = null;
        const needsInit = previewCampaignId ? !previewCampaign : !device;
        if (needsInit || error) {
            timer = setTimeout(() => {
                console.log("[Screen] Background auto-retry syncing with server...");
                setIsRetrying(prev => !prev);
            }, 6000);
        }
        return () => { if (timer) clearTimeout(timer); };
    }, [device, previewCampaign, previewCampaignId, error, isRetrying]);

    // Connectivity Watchdog: Auto-reload if offline for too long (conservative: 180 seconds / 3 minutes)
    useEffect(() => {
        if (previewCampaignId) return;
        let lastSeenOnline = Date.now();
        
        const interval = setInterval(() => {
            const isOnline = server.isConnected;
            if (isOnline) {
                lastSeenOnline = Date.now();
            } else {
                const offlineDuration = Date.now() - lastSeenOnline;
                // If offline for more than 180 seconds (3 minutes), force auto-recovery reload
                if (offlineDuration > 180 * 1000) {
                    console.warn(`[Watchdog] Persistent offline state detected (180s). Auto-reloading...`);
                    const deviceId = safeStorage.getItem('storecast_device_id');
                    if (deviceId) {
                        server.sendDeviceLogs(deviceId, [`[Watchdog] Persistent offline state (180s). Triggering auto-recovery reload.`]).catch(() => {});
                    }
                    const now = Date.now();
                    const lastReload = parseInt(safeStorage.getItem('storecast_last_reload_timestamp') || '0');
                    if (now - lastReload >= 30000) {
                        safeStorage.setItem('storecast_last_reload_timestamp', now.toString());
                        setTimeout(() => window.location.reload(), 1000);
                    }
                }
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [previewCampaignId]);

    // Proactive Scheduled Reload
    // TVs can run out of memory (OOM) if running for days, even with static images/videos.
    // We force a full reload every 2 hours to clear RAM/GPU textures and network pools.
    useEffect(() => {
        const SCHEDULED_RELOAD_MS = 2 * 60 * 60 * 1000; // 2 hours
        const timeoutId = setTimeout(() => {
            console.log("[Screen] Performing scheduled 2-hour proactive reload to prevent OOM.");
            window.location.reload();
        }, SCHEDULED_RELOAD_MS);
        
        return () => clearTimeout(timeoutId);
    }, []);

    // Memory Monitor & Auto-Recovery (Log every 1 minute if supported)
    useEffect(() => {
        if (previewCampaignId) return;
        const interval = setInterval(() => {
            const perf = performance as any;
            if (perf && perf.memory) {
                const used = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
                const total = Math.round(perf.memory.totalJSHeapSize / 1024 / 1024);
                const limit = Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024);
                
                const log = `[MEMORY] Used: ${used}MB / Allocated: ${total}MB / Limit: ${limit}MB`;
                
                const id = safeStorage.getItem('storecast_device_id');
                if (id) {
                    server.sendDeviceLogs(id, [log]).catch(() => {});
                }

                // If memory usage exceeds 80% of the hard limit, proactively reload to avoid a white-screen freeze
                if (limit > 0 && used > limit * 0.8) {
                    const warnLog = `[CRITICAL] Memory at ${Math.round((used/limit)*100)}% capacity. Proactively reloading to prevent freeze.`;
                    console.warn(warnLog);
                    if (id) {
                        server.sendDeviceLogs(id, [warnLog]).finally(() => {
                            setTimeout(() => window.location.reload(), 500);
                        });
                    } else {
                        setTimeout(() => window.location.reload(), 500);
                    }
                }
            }
        }, 60 * 1000); // 1 minute

        return () => clearInterval(interval);
    }, [previewCampaignId]);

    // State Polling Loop (Aggressive: 15 seconds)
    useEffect(() => {
        if (previewCampaignId) return;
        const poll = async () => {
            try {
                // initDevice will trigger this.notify(device) in server.ts
                // which updates the local state via the subscribe listener above.
                const screenW = window.screen?.width || window.innerWidth;
                const screenH = window.screen?.height || window.innerHeight;
                const resolution = `${screenW}x${screenH}`;
                const userAgent = navigator.userAgent;
                await server.initDevice(deviceId, resolution, userAgent);
            } catch (e) {
                console.warn("[Screen] Polling failed", e);
            }
        };

        const interval = setInterval(poll, 15000);
        return () => clearInterval(interval);
    }, [deviceId, previewCampaignId]);

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        server.setServerUrl(customUrl);
        // setServerUrl reloads the page, so no need to manage state after this
    };

    const forceMock = false;
    if (error && !device && !previewCampaign && !forceMock) {
        return (
            <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white gap-6 p-6 text-center">
                <div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-4">
                    <WifiOff size={48} />
                </div>
                <h2 className="text-2xl font-bold">Cannot Connect to Server</h2>
                <p className="text-slate-400 max-w-md">
                    Ensure the backend server is running on <br />
                    <code className="bg-slate-800 px-2 py-1 rounded text-sm font-mono">{server.getServerUrl()}</code>
                </p>

                <div className="flex gap-3 flex-wrap justify-center">
                    <button
                        onClick={() => setIsRetrying(true)}
                        disabled={isRetrying}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                    >
                        {isRetrying ? <Loader2 className="animate-spin" size={20} /> : <RefreshCcw size={20} />}
                        Retry Connection
                    </button>
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                        <Settings size={20} />
                    </button>
                </div>

                {showConfig && (
                    <form onSubmit={handleSaveConfig} className="mt-6 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 w-full max-w-md animate-fade-in">
                        <label className="text-xs text-left text-slate-400 uppercase font-bold">Server Endpoint</label>
                        <input
                            type="text"
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                        />
                        <button type="submit" className="bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm font-medium transition-colors">
                            Save & Reload
                        </button>
                    </form>
                )}
            </div>
        );
    }

    if (!device && !forceMock && !previewCampaign) {
        return (
            <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '1rem' }}>
                <Loader2 className="animate-spin" size={48} />
                <p style={{ color: '#94a3b8' }}>Connecting to server...</p>
            </div>
        );
    }

    // UNREGISTERED STATE: Show Pairing Code
    if (!forceMock && device && !device.isRegistered) {
        return (
            <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white gap-8 p-6 text-center">
                <div className="flex flex-col items-center gap-2">
                    <Monitor size={64} className="text-blue-500 mb-4" />
                    <h1 className="text-3xl font-bold">Pair Your Device</h1>
                    <p className="text-slate-400">Enter this code in the admin portal to register this screen.</p>
                </div>
                
                <div className="bg-slate-800 border-2 border-blue-500/30 px-10 py-6 rounded-2xl shadow-2xl">
                    <span className="text-6xl font-mono font-bold tracking-[0.5em] text-blue-100 pl-[0.5em]">
                        {device.pairingCode || '------'}
                    </span>
                </div>

                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
                        <div className={`w-2 h-2 rounded-full ${server.isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-xs font-medium text-slate-400">
                            {server.isConnected ? 'Connected to Server' : 'Disconnected'}
                        </span>
                    </div>
                    {deviceId && (
                        <p className="text-[10px] text-slate-600 font-mono">ID: {deviceId}</p>
                    )}
                </div>
            </div>
        );
    }

    const MOCK_PLAYLIST = [
        { id: 'v1', type: 'VIDEO' as any, url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', name: 'Vid1', duration: 5, playUntilDone: false },
        { id: 'v2', type: 'VIDEO' as any, url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', name: 'Vid2', duration: 5, playUntilDone: false }
    ];

    // REGISTERED STATE: Play Content
    const zoomStyle = device?.zoom && device.zoom !== 1 ? { transform: `scale(${device.zoom})`, transformOrigin: 'top left', width: `${100 / device.zoom}%`, height: `${100 / device.zoom}%`, overflow: 'hidden' } : { width: '100vw', height: '100vh', overflow: 'hidden' };

    if (previewCampaign) {
        return (
            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
                <Player
                    campaign={previewCampaign}
                    layout={previewCampaign.layout}
                    assets={[]} // Campaigns use zone playlists
                    onExit={onExit}
                    rotation={overrideRotation !== null && !isNaN(overrideRotation) ? overrideRotation : 0}
                    deviceId={undefined}
                />
            </div>
        );
    }

    return (
        <div style={zoomStyle}>
            <ErrorBoundary>
                <Player
                    campaign={device?.campaign}
                    layout={device?.layout}
                    assets={forceMock ? MOCK_PLAYLIST : (device?.playlist || [])}
                    onExit={onExit}
                    rotation={overrideRotation !== null && !isNaN(overrideRotation) ? overrideRotation : (device?.rotation || 0)}
                    deviceId={device?.id || 'mock-id'}
                    overlay={device?.overlay}
                />
            </ErrorBoundary>
        </div>
    );
};
