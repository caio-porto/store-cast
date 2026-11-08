import { Asset, Device, Group, DEFAULT_ASSETS, User, AuditLogEntry, SystemConfig, Layout, Campaign, Playlist } from '../types';

import { CONFIG } from '../config';

const STORAGE_KEY_URL = 'storecast_server_url';
const STORAGE_KEY_TOKEN = 'storecast_token';
const STORAGE_KEY_USER = 'storecast_user_info';


// Safe Storage Helper to prevent SecurityError in sandboxed iframes
export const safeStorage = {
    getItem(key: string) {
        try { 
            const val = localStorage.getItem(key);
            if (val) return val;
        } catch (e) { }
        try {
            const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
            if (match) return match[2];
        } catch (e) { }
        return null;
    },
    setItem(key: string, value: string) {
        try { localStorage.setItem(key, value); } catch (e) { }
        try {
            document.cookie = `${key}=${value}; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/`;
        } catch (e) { }
    },
    removeItem(key: string) {
        try { localStorage.removeItem(key); } catch (e) { }
        try {
            document.cookie = `${key}=; Max-Age=-99999999; path=/`;
        } catch (e) { }
    }
};

class RealServer {
    private listeners: ((data?: any) => void)[] = [];
    private deviceCache: Device[] = [];
    private groupCache: Group[] = [];
    private layoutCache: Layout[] = [];
    private campaignCache: Campaign[] = [];
    private playlistCache: Playlist[] = [];
    private ws: WebSocket | null = null;
    private reconnectTimeout: any = null;

    public isConnected: boolean = false;
    public currentUser: User | null = null;
    public authToken: string | null = null;

    constructor() {
        this.loadSession();
    }

    // --- Auth & Session ---
    private loadSession() {
        const token = safeStorage.getItem(STORAGE_KEY_TOKEN);
        const userStr = safeStorage.getItem(STORAGE_KEY_USER);
        if (token && userStr) {
            this.authToken = token;
            this.currentUser = JSON.parse(userStr);
        }
    }

    async login(email: string, password: string): Promise<boolean> {
        try {
            const url = this.getAdminUrl();
            const res = await fetch(`${url}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                this.authToken = data.token;
                this.currentUser = data.user;
                safeStorage.setItem(STORAGE_KEY_TOKEN, data.token);
                safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
                return true;
            } else {
                if (data.message) alert(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    logout() {
        if (this.authToken) {
            const url = this.getAdminUrl();
            fetch(`${url}/api/logout`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            }).catch(console.error);
        }
        this.authToken = null;
        this.currentUser = null;
        safeStorage.removeItem(STORAGE_KEY_TOKEN);
        safeStorage.removeItem(STORAGE_KEY_USER);
        window.location.reload();
    }

    // --- Password Recovery ---
    async forgotPassword(email: string): Promise<boolean> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });
            const data = await res.json();
            if (res.ok) return { success: true };
            return { success: false, message: data.error || 'Failed to reset' };
        } catch (e) {
            return { success: false, message: 'Network error' };
        }
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };
    }

    // --- Url Management ---

    public getServerUrl() {
        // 1. Manual Override from LocalStorage
        const stored = safeStorage.getItem(STORAGE_KEY_URL);
        if (stored) return stored;

        if (typeof window !== 'undefined') {
            const { hostname, protocol, origin } = window.location;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return origin;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_SCREEN) {
                return `${protocol}//${hostname}`;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_ADMIN) {
                return `${protocol}//${CONFIG.PRODUCTION.DOMAIN_SCREEN}`;
            }
        }

        if (CONFIG.IS_PRODUCTION) {
            const { hostname, protocol } = window.location;
            const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;

            if (isCapacitor || protocol === 'file:' || protocol === 'capacitor:') {
                return `https://${CONFIG.PRODUCTION.DOMAIN_SCREEN}`;
            }

            if (hostname === CONFIG.PRODUCTION.DOMAIN_SCREEN) {
                return `${protocol}//${hostname}`;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_ADMIN) {
                return `${protocol}//${CONFIG.PRODUCTION.DOMAIN_SCREEN}`;
            }
            return `https://${CONFIG.PRODUCTION.DOMAIN_SCREEN}`;
        }

        // 4. Fallback (Local Development)
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        return `http://${hostname}:${CONFIG.LOCAL.DEFAULT_SCREEN_PORT}`;
    }

    public getScreenUrl() {
        if (typeof window !== 'undefined') {
            const { hostname, protocol, origin } = window.location;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                // If we are on port 8766 (Admin), we need to point to 8765 (Screen)
                if (window.location.port === CONFIG.LOCAL.DEFAULT_ADMIN_PORT.toString()) {
                    return `${protocol}//${hostname}:${CONFIG.LOCAL.DEFAULT_SCREEN_PORT}`;
                }
                return origin;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_ADMIN) {
                return `${protocol}//${CONFIG.PRODUCTION.DOMAIN_SCREEN}`;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_SCREEN) {
                return `${protocol}//${hostname}`;
            }
        }

        if (CONFIG.IS_PRODUCTION) {
            return `https://${CONFIG.PRODUCTION.DOMAIN_SCREEN}`;
        }

        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        return `http://${hostname}:${CONFIG.LOCAL.DEFAULT_SCREEN_PORT}`;
    }

    public getAdminUrl() {
        if (typeof window !== 'undefined') {
            const { hostname, protocol, origin } = window.location;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                // If we are on port 8765 (Screen), we need to point to 8766 (Admin)
                if (window.location.port === CONFIG.LOCAL.DEFAULT_SCREEN_PORT.toString()) {
                    return `${protocol}//${hostname}:${CONFIG.LOCAL.DEFAULT_ADMIN_PORT}`;
                }
                return origin;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_ADMIN) {
                return `${protocol}//${hostname}`;
            }
            if (hostname === CONFIG.PRODUCTION.DOMAIN_SCREEN) {
                return `${protocol}//${CONFIG.PRODUCTION.DOMAIN_ADMIN}`;
            }
        }

        if (CONFIG.IS_PRODUCTION) {
            return `https://${CONFIG.PRODUCTION.DOMAIN_ADMIN}`;
        }

        // Fallback (Local Development)
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        return `http://${hostname}:${CONFIG.LOCAL.DEFAULT_ADMIN_PORT}`;
    }

    public setServerUrl(url: string) {
        // Only for Screen mode configuration
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http')) cleanUrl = `http://${cleanUrl}`;
        cleanUrl = cleanUrl.replace(/\/$/, "");
        safeStorage.setItem(STORAGE_KEY_URL, cleanUrl);
        window.location.reload();
    }

    // --- State Management ---
    subscribe(callback: (data?: any) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notify(data?: any) {
        this.listeners.forEach(cb => cb(data));
    }



    // --- Screen Methods (Port 8765 or Domain) ---

    async initDevice(deviceId: string, resolution?: string, userAgent?: string): Promise<Device> {
        const cacheKey = `storecast_cached_device_${deviceId}`;
        try {
            const url = this.getServerUrl();
            const currentCache = this.deviceCache.find(d => d.id === deviceId);
            
            // 10-Second Abort Controller to prevent infinite fetch hang on high latency
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(`${url}/api/device/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, playlistHash: currentCache?.playlistHash, resolution, userAgent }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const device = await res.json();
            this.isConnected = true;

            // Optimistic Unchanged Merge: if backend says unchanged, restore it from RAM map
            if (device.playlistUnchanged && currentCache) {
                 device.playlist = currentCache.playlist;
            }

            // Local fallback for display
            if ((device.playlist?.length || 0) === 0 && !device.isRegistered && !device.groupId) {
                device.playlist = DEFAULT_ASSETS;
            }

            // Persist to safeStorage for instant boot next time
            try { safeStorage.setItem(cacheKey, JSON.stringify(device)); } catch (e) {}

            // Keep cache active for the next poll validation hash
            const cIdx = this.deviceCache.findIndex(d => d.id === device.id);
            if (cIdx !== -1) {
                this.deviceCache[cIdx] = device;
            } else {
                this.deviceCache.push(device);
            }
            
            this.notify(device);
            return device;
        } catch (e: any) {
            this.isConnected = false;
            this.notify();
            
            // High Latency / Offline Fallback: Load from safeStorage cache if available
            const cachedStr = safeStorage.getItem(cacheKey);
            if (cachedStr) {
                try {
                    const cachedDev = JSON.parse(cachedStr);
                    console.warn("[Server] Using offline cached device state due to connection latency/error:", e?.message);
                    return cachedDev;
                } catch (err) {}
            }
            
            throw e;
        }
    }

    public connectWebSocket(deviceId: string, onUpdate?: (d: Device) => void) {
        if (this.reconnectTimeout) { clearTimeout(this.reconnectTimeout); this.reconnectTimeout = null; }
        if (this.ws) { this.ws.onclose = null; this.ws.close(); }

        try {
            // Robust protocol replacement (http->ws, https->wss)
            const httpUrl = this.getServerUrl();
            // Secure Protocol Detection: If HTTPS, we MUST use WSS or browser will block the connection
            let wsUrl = httpUrl.replace(/^http/, 'ws');
            if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws:')) {
                wsUrl = wsUrl.replace('ws:', 'wss:');
            }
 
            this.ws = new WebSocket(wsUrl + '/ws');

            this.ws.onopen = () => {
                this.isConnected = true;
                this.notify();
                this.ws?.send(JSON.stringify({ type: 'IDENTIFY', deviceId }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'UPDATE' && data.device) {
                        const index = this.deviceCache.findIndex(d => d.id === data.device.id);
                        if (index !== -1) {
                            // Immutable update to ensure React re-renders
                            this.deviceCache[index] = { ...data.device };
                        } else {
                            this.deviceCache.push({ ...data.device });
                        }
                        onUpdate(data.device);
                        this.notify(data);
                    } else if (data.type === 'RELOAD') {
                        this.notify(data);
                    } else if (data.type === 'DEVICE_UPDATE') {
                        const { deviceId, currentAssetId } = data;
                        console.log(`[WS] Real-time update received for ${deviceId}: ${currentAssetId}`);
                        const index = this.deviceCache.findIndex(d => d.id === deviceId);
                        if (index !== -1) {
                            // Immutable update is CRITICAL for React to see the change
                            this.deviceCache[index] = { ...this.deviceCache[index], currentAssetId };
                            this.notify();
                        } else {
                            console.warn(`[WS] ID MISMATCH: Update for ${deviceId} but only these IDs are active:`, this.deviceCache.map(d => d.id));
                        }
                    }
                } catch (e) { }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.notify();
                this.reconnectTimeout = setTimeout(() => this.connectWebSocket(deviceId, onUpdate), 5000);
            };
        } catch (e) { }
    }

    getDeviceSync(deviceId: string): Device | null {
        return this.deviceCache.find(d => d.id === deviceId) || null;
    }

    // --- Admin Methods (Port 8766 or Domain) ---

    async fetchAllDevices() {
        if (!this.authToken) return;
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/devices`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.deviceCache = await res.json();
                this.isConnected = true;
                this.notify();
            } else if (res.status === 401) {
                this.logout();
            }
        } catch (e) {
            this.isConnected = false;
            this.notify();
        }
    }

    getAllDevices(): Device[] { return this.deviceCache; }

    // --- Layout Methods ---
    async fetchAllLayouts() {
        if (!this.authToken) return;
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/layouts`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.layoutCache = await res.json();
                this.notify();
            }
        } catch (e) { }
    }

    getAllLayouts(): Layout[] { return this.layoutCache; }

    async createLayout(name: string, zones: any[]): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/layouts`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name, zones })
            });
            const data = await res.json();
            if (res.ok) {
                this.layoutCache.push(data);
                this.notify();
                return { success: true };
            }
            return { success: false, message: data.error || "Failed to create layout" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async updateLayout(id: string, name: string, zones: any[]): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/layouts/${id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name, zones })
            });
            if (res.ok) {
                const layout = this.layoutCache.find(l => l.id === id);
                if (layout) {
                    layout.name = name;
                    layout.zones = zones;
                }
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Failed to update layout" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async deleteLayout(id: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/layouts/${id}`, { method: 'DELETE', headers: this.getAuthHeaders() });
            if (res.ok) {
                this.layoutCache = this.layoutCache.filter(l => l.id !== id);
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Failed to delete layout" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    // --- Campaign Methods ---
    async fetchAllCampaigns() {
        if (!this.authToken) return;
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/campaigns`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.campaignCache = await res.json();
                this.notify();
            }
        } catch (e) { }
    }

    getAllCampaigns(): Campaign[] { return this.campaignCache; }

    async createCampaign(name: string, layoutId: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/campaigns`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name, layoutId })
            });
            const data = await res.json();
            if (res.ok) {
                this.campaignCache.push(data);
                this.notify();
                return { success: true };
            }
            return { success: false, message: data.error || "Failed to create campaign" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async updateCampaign(id: string, updates: { name?: string, layoutId?: string, zonePlaylists?: Record<string, Asset[]> }): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/campaigns/${id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const campaign = this.campaignCache.find(c => c.id === id);
                if (campaign) {
                    if (updates.name) campaign.name = updates.name;
                    if (updates.layoutId) campaign.layoutId = updates.layoutId;
                    if (updates.zonePlaylists) campaign.zonePlaylists = updates.zonePlaylists;
                }
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Failed to update campaign" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async deleteCampaign(id: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/campaigns/${id}`, { method: 'DELETE', headers: this.getAuthHeaders() });
            if (res.ok) {
                this.campaignCache = this.campaignCache.filter(c => c.id !== id);
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Failed to delete campaign" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    // --- Saved Playlists ---
    async fetchSavedPlaylists() {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/playlists`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.playlistCache = await res.json();
                this.notify();
            }
        } catch (e) { }
    }

    getAllSavedPlaylists(): Playlist[] { return this.playlistCache; }

    async createSavedPlaylist(name: string, assets: Asset[]): Promise<{ success: boolean, playlist?: Playlist }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/playlists`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name, assets })
            });
            if (res.ok) {
                const newPlaylist = await res.json();
                this.playlistCache.push(newPlaylist);
                this.notify();
                return { success: true, playlist: newPlaylist };
            }
            return { success: false };
        } catch (e) { return { success: false }; }
    }

    async updateSavedPlaylist(id: string, name?: string, assets?: Asset[]): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/playlists/${id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name, assets })
            });
            if (res.ok) {
                const idx = this.playlistCache.findIndex(p => p.id === id);
                if (idx !== -1) {
                    if (name) this.playlistCache[idx].name = name;
                    if (assets) this.playlistCache[idx].assets = assets;
                }
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Failed to update playlist" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async deleteSavedPlaylist(id: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/playlists/${id}`, { method: 'DELETE', headers: this.getAuthHeaders() });
            if (res.ok) {
                this.playlistCache = this.playlistCache.filter(p => p.id !== id);
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Failed to delete playlist" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async setDeviceCampaign(deviceId: string, campaignId: string | null) {
        try {
            const dev = this.deviceCache.find(d => d.id === deviceId);
            if (dev) dev.campaignId = campaignId || undefined;
            this.notify();

            await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/campaign`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ campaignId })
            });
        } catch (e) { }
    }

    async setGroupCampaign(groupId: string, campaignId: string | null) {
        try {
            const group = this.groupCache.find(g => g.id === groupId);
            if (group) group.campaignId = campaignId;
            this.notify();

            await fetch(`${this.getAdminUrl()}/api/groups/${groupId}/campaign`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ campaignId })
            });
            // Refetch devices because they might have inherited this campaign
            this.fetchAllDevices();
        } catch (e) { }
    }

    async playNow(deviceId: string, assetId: string): Promise<{ success: boolean }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/play-now`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ assetId })
            });
            return res.ok ? { success: true } : { success: false };
        } catch (e) { return { success: false }; }
    }

    async registerDevice(pairingCode: string, name: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/register`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ pairingCode, name })
            });
            const data = await res.json();
            if (data.success) {
                this.fetchAllDevices();
                return { success: true };
            }
            return { success: false, message: data.message || "Registration failed" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async deleteDevice(deviceId: string) {
        try {
            await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}`, { method: 'DELETE', headers: this.getAuthHeaders() });
            this.deviceCache = this.deviceCache.filter(d => d.id !== deviceId);
            this.notify();
        } catch (e) { }
    }

    async updatePlaylist(deviceId: string, playlist: Asset[]): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/playlist`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ playlist })
            });

            if (res.ok) {
                const dev = this.deviceCache.find(d => d.id === deviceId);
                if (dev) dev.playlist = playlist;
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Update failed" };
        } catch (e: any) {
            return { success: false, message: e.message || "Network error" };
        }
    }

    async setDeviceGroup(deviceId: string, groupId: string | null) {
        try {
            const dev = this.deviceCache.find(d => d.id === deviceId);
            if (dev) dev.groupId = groupId || undefined;
            this.notify();

            await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/group`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ groupId })
            });
        } catch (e) { }
    }

    async updateDevice(deviceId: string, updates: { name?: string, rotation?: number, overlay?: string }): Promise<{ success: boolean, message?: string }> {
        try {
            const dev = this.deviceCache.find(d => d.id === deviceId);

            const res = await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                if (dev) {
                    if (updates.name) dev.name = updates.name;
                    if (typeof updates.rotation === 'number') dev.rotation = updates.rotation;
                    if (updates.overlay !== undefined) dev.overlay = updates.overlay;
                }
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Update failed" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async setDeviceOwner(deviceId: string, ownerId: string) {
        try {
            const dev = this.deviceCache.find(d => d.id === deviceId);
            if (dev) dev.ownerId = ownerId;
            this.notify();

            await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/owner`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ ownerId })
            });
        } catch (e) { }
    }

    async notifyDevice(id: string) {
        // This method was private in backend, but here on frontend client it might not be needed or used differently.
        // Keeping placeholder if needed or just removing if not used. 
        // Actually, looking at the code, notifyDevice is a server-side function in index.js. 
        // In server.ts (frontend service), we don't need it. 
        // So I will just add the log methods here.
    }

    async sendDeviceLogs(deviceId: string, logs: string[]) {
        try {
            const url = this.getServerUrl();
            const nowIso = new Date().toISOString();
            const timestampedLogs = logs.map(l => {
                if (typeof l === 'string' && /^\[\d{4}-\d{2}-\d{2}/.test(l)) return l;
                return `[${nowIso}] ${l}`;
            });
            await fetch(`${url}/api/devices/${deviceId}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: timestampedLogs })
            });
        } catch (e) {
            // silent fail or console local 
            console.error("Failed to send logs", e);
        }
    }

    reportState(deviceId: string, currentAssetId: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'REPORT_STATE', deviceId, currentAssetId }));
        }
    }

    async fetchDeviceLogs(deviceId: string): Promise<string[]> {
        if (!this.authToken) return [];
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/logs`, {
                headers: this.getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                return data.logs || [];
            }
        } catch (e) { }
        return [];
    }

    // --- Group Methods ---

    async fetchAllGroups() {
        if (!this.authToken) return;
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/groups`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.groupCache = await res.json();
                this.notify();
            }
        } catch (e) { }
    }

    getAllGroups(): Group[] { return this.groupCache; }

    async createGroup(name: string): Promise<{ success: boolean, message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/groups`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (res.ok) {
                this.groupCache.push(data);
                this.notify();
                return { success: true };
            }
            return { success: false, message: data.error || "Failed to create group" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async deleteGroup(groupId: string) {
        try {
            await fetch(`${this.getAdminUrl()}/api/groups/${groupId}`, { method: 'DELETE', headers: this.getAuthHeaders() });
            this.groupCache = this.groupCache.filter(g => g.id !== groupId);
            this.notify();
        } catch (e) { }
    }

    async updateGroup(groupId: string, updates: { overlay?: string }): Promise<{ success: boolean, message?: string }> {
        try {
            const grp = this.groupCache.find(g => g.id === groupId);

            const res = await fetch(`${this.getAdminUrl()}/api/groups/${groupId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                if (grp) {
                    if (updates.overlay !== undefined) grp.overlay = updates.overlay;
                }
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Update failed" };
        } catch (e) { return { success: false, message: "Network error" }; }
    }

    async updateGroupPlaylist(groupId: string, playlist: Asset[]): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/groups/${groupId}/playlist`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ playlist })
            });

            if (res.ok) {
                const grp = this.groupCache.find(g => g.id === groupId);
                if (grp) grp.playlist = playlist;
                this.notify();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, message: data.error || "Update failed" };
        } catch (e: any) {
            return { success: false, message: e.message || "Network error" };
        }
    }

    uploadAsset(content: string, name?: string, onProgress?: (percent: number) => void): Promise<{ success: boolean; url?: string; message?: string }> {
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.getAdminUrl()}/api/upload`);
            const headers = this.getAuthHeaders();
            Object.keys(headers).forEach(k => xhr.setRequestHeader(k, headers[k]));

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                };
            }

            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                        resolve({ success: true, url: data.url });
                    } else {
                        resolve({ success: false, message: data.error || `Upload failed (HTTP ${xhr.status})` });
                    }
                } catch (e: any) {
                    if (xhr.status === 413) {
                        resolve({ success: false, message: "File is too large for the server (HTTP 413 Request Entity Too Large). Check Nginx client_max_body_size." });
                    } else if (xhr.status === 504) {
                        resolve({ success: false, message: "Gateway timeout (HTTP 504). Video transcoding took too long." });
                    } else if (xhr.status === 502) {
                        resolve({ success: false, message: "Bad gateway (HTTP 502). Server is restarting or unavailable." });
                    } else if (xhr.status >= 400) {
                        resolve({ success: false, message: `Server error (${xhr.status}: ${xhr.statusText || 'Upload failed'})` });
                    } else {
                        resolve({ success: false, message: e.message || "Invalid server response" });
                    }
                }
            };

            xhr.onerror = () => resolve({ success: false, message: "Network error during upload" });
            xhr.send(JSON.stringify({ content, name }));
        });
    }

    async refreshDevice(deviceId: string): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/devices/${deviceId}/refresh`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            const data = await res.json();
            return { success: res.ok && data.success, message: data.error || data.message };
        } catch (e: any) {
            return { success: false, message: e.message || "Network error" };
        }
    }

    async fetchPreviewCampaign(campaignId: string): Promise<any> {
        try {
            const url = this.getServerUrl();
            const res = await fetch(`${url}/api/preview-campaign/${campaignId}`);
            if (res.ok) return await res.json();
            const adminRes = await fetch(`${this.getAdminUrl()}/api/preview-campaign/${campaignId}`);
            return adminRes.ok ? await adminRes.json() : null;
        } catch (e) {
            console.error("[SERVER] fetchPreviewCampaign error", e);
            return null;
        }
    }

    // --- User & System Mgmt ---

    async fetchUsers(): Promise<User[]> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/users`, { headers: this.getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }

    async createUser(user: Partial<User>) {
        await fetch(`${this.getAdminUrl()}/api/users`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(user)
        });
    }

    async updateUser(id: string, updates: Partial<User>) {
        await fetch(`${this.getAdminUrl()}/api/users/${id}`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(updates)
        });
    }

    async deleteUser(id: string) {
        await fetch(`${this.getAdminUrl()}/api/users/${id}`, { method: 'DELETE', headers: this.getAuthHeaders() });
    }

    async updatePassword(newPassword: string) {
        await fetch(`${this.getAdminUrl()}/api/profile/password`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ newPassword })
        });
    }

    async fetchConfig(): Promise<SystemConfig | null> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/config`, { headers: this.getAuthHeaders() });
            return res.ok ? await res.json() : null;
        } catch (e) { return null; }
    }

    async updateConfig(config: Partial<SystemConfig>) {
        await fetch(`${this.getAdminUrl()}/api/config`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(config)
        });
    }

    async fetchAuditLogs(): Promise<AuditLogEntry[]> {
        try {
            const res = await fetch(`${this.getAdminUrl()}/api/audit`, { headers: this.getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }
}

export const server = new RealServer();