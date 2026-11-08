const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const { exec } = require('child_process');



// --- Configuration ---
const SCREEN_PORT = 8765;
const ADMIN_PORT = 8766;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DIST_DIR = path.join(__dirname, '../dist');
console.log("Static files will be served from:", DIST_DIR);

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- Database Setup ---
const db = new sqlite3.Database(DB_FILE);
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA busy_timeout = 5000;");
db.run("PRAGMA synchronous = NORMAL;");

// Helper to run queries with Promises
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Initialize Schema
async function initDB() {
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        passwordHash TEXT,
        role TEXT,
        createdAt INTEGER
    )`);

    // Migration: Add isTempPassword column if it doesn't exist
    try {
        await dbRun(`ALTER TABLE users ADD COLUMN isTempPassword INTEGER DEFAULT 0`);
    } catch (e) {
        // Column likely exists
    }

    // Migration: Add overlay properties to devices and groups
    const overlayProps = ['overlayX', 'overlayY', 'overlayW', 'overlayH'];
    for (const prop of overlayProps) {
        try { await dbRun(`ALTER TABLE devices ADD COLUMN ${prop} REAL DEFAULT ${prop.endsWith('W') || prop.endsWith('H') ? 100 : 0}`); } catch (e) { }
        try { await dbRun(`ALTER TABLE groups ADD COLUMN ${prop} REAL DEFAULT ${prop.endsWith('W') || prop.endsWith('H') ? 100 : 0}`); } catch (e) { }
    }

    try { await dbRun(`ALTER TABLE devices ADD COLUMN overlay TEXT`); } catch (e) { }
    try { await dbRun(`ALTER TABLE groups ADD COLUMN overlay TEXT`); } catch (e) { }
    try { await dbRun(`ALTER TABLE devices ADD COLUMN currentAssetId TEXT`); } catch (e) { }
    try { await dbRun(`ALTER TABLE devices ADD COLUMN lastReloadTime INTEGER DEFAULT 0`); } catch (e) { }
    try { await dbRun(`ALTER TABLE devices ADD COLUMN resolution TEXT`); } catch (e) { }
    try { await dbRun(`ALTER TABLE devices ADD COLUMN userAgent TEXT`); } catch (e) { }
    try { await dbRun(`ALTER TABLE devices ADD COLUMN zoom REAL DEFAULT 1.0`); } catch (e) { }
    try { await dbRun(`ALTER TABLE devices ADD COLUMN campaignId TEXT`); } catch (e) { }

    await dbRun(`CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT,
        pairingCode TEXT,
        isRegistered INTEGER,
        lastSeen INTEGER,
        playlist TEXT,
        groupId TEXT,
        rotation INTEGER,
        ownerId TEXT,
        currentAssetId TEXT,
        lastReloadTime INTEGER DEFAULT 0,
        resolution TEXT,
        userAgent TEXT,
        zoom REAL DEFAULT 1.0,
        campaignId TEXT,
        overlay TEXT,
        overlayX REAL DEFAULT 0,
        overlayY REAL DEFAULT 0,
        overlayW REAL DEFAULT 100,
        overlayH REAL DEFAULT 100
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS layouts (
        id TEXT PRIMARY KEY,
        name TEXT,
        zones TEXT,
        isSystem INTEGER DEFAULT 0,
        ownerId TEXT
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT,
        assets TEXT,
        ownerId TEXT
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT,
        layoutId TEXT,
        zonePlaylists TEXT,
        ownerId TEXT
    )`);

    // Ensure Default Layout exists
    const defaultLayout = await dbGet("SELECT * FROM layouts WHERE id = 'default_fullscreen'");
    if (!defaultLayout) {
        await dbRun("INSERT INTO layouts (id, name, zones, isSystem) VALUES (?, ?, ?, ?)", [
            'default_fullscreen', 'Fullscreen', JSON.stringify([{ id: 'main', x: 0, y: 0, w: 100, h: 100 }]), 1
        ]);
    }

    await dbRun(`CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT,
        playlist TEXT,
        campaignId TEXT,
        ownerId TEXT,
        overlay TEXT,
        overlayX REAL DEFAULT 0,
        overlayY REAL DEFAULT 0,
        overlayW REAL DEFAULT 100,
        overlayH REAL DEFAULT 100
    )`);

    // Migration: Add campaignId to groups if not exists
    const groupCols = await dbAll("PRAGMA table_info(groups)");
    if (!groupCols.some(c => c.name === 'campaignId')) {
        await dbRun("ALTER TABLE groups ADD COLUMN campaignId TEXT");
    }

    await dbRun(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER,
        userEmail TEXT,
        action TEXT,
        details TEXT
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        userId TEXT,
        email TEXT,
        role TEXT,
        isTempPassword INTEGER DEFAULT 0,
        createdAt INTEGER
    )`);

    // Create Admin if not exists
    const admin = await dbGet("SELECT * FROM users WHERE email = ?", ['admin@storecast.com']);
    if (!admin) {
        await dbRun("INSERT INTO users (id, email, passwordHash, role, createdAt, isTempPassword) VALUES (?, ?, ?, ?, ?, ?)",
            ['admin', 'admin@storecast.com', hashPassword('password'), 'ADMIN', Date.now(), 0]
        );
        console.log("Default admin created.");
    }
}

initDB().catch(console.error);

// --- In-Memory Config & Session ---
let systemConfig = {
    allowOwnerEdit: true,
    mailHost: 'smtp.gmail.com',
    mailPort: 465,
    mailUser: process.env.MAIL_USER || '',
    mailPass: process.env.MAIL_PASS || '',
    mailFrom: '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || ''
};

function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            systemConfig = { ...systemConfig, ...loaded };
            console.log("Loaded system config from file.");
        } catch (e) {
            console.error("Failed to load config file:", e);
        }
    }
}
loadConfig();

function saveConfig() { fs.writeFileSync(CONFIG_FILE, JSON.stringify(systemConfig, null, 2)); }

let sessions = new Map(); // token -> user object
let resetTokens = new Map(); // email -> { code, expires }
const loginAttempts = new Map(); // ip -> { count, firstAttempt }

// --- Email Service ---
let transporter = null;

function initMailer() {
    if (systemConfig.mailUser && systemConfig.mailPass) {
        const port = systemConfig.mailPort || 465;
        transporter = nodemailer.createTransport({
            host: systemConfig.mailHost || "smtp.gmail.com",
            port: port,
            secure: port === 465, // Use true for 465, false for 587
            auth: {
                user: systemConfig.mailUser,
                pass: systemConfig.mailPass,
            },
        });
    }
}
initMailer();

async function sendEmail(to, subject, html) {
    if (!transporter) initMailer(); // Try to init if config updated

    if (!transporter) {
        console.log("---------------------------------------------------");
        console.log(`[EMAIL MOCK] (Credentials not set in config.json)`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log("---------------------------------------------------");
        return false;
    }

    const fromAddress = systemConfig.mailFrom || systemConfig.mailUser;

    try {
        await transporter.sendMail({
            from: `"Store Cast System" <${fromAddress}>`,
            to,
            subject,
            html
        });
        console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
        return true;
    } catch (e) {
        console.error("[EMAIL ERROR]", e);
        return false;
    }
}

// --- Helper Functions ---

function hashPassword(pwd) {
    return crypto.createHash('sha256').update(pwd).digest('hex');
}

function generatePairingCode() {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generateTempPassword() {
    return crypto.randomBytes(4).toString('hex'); // 8 char hex string
}

async function logAudit(user, action, details) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    await dbRun("INSERT INTO audit_logs (id, timestamp, userEmail, action, details) VALUES (?, ?, ?, ?, ?)",
        [id, Date.now(), user ? user.email : 'SYSTEM', action, details]
    );

    // Cleanup old logs (keep last 90 days)
    const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    await dbRun("DELETE FROM audit_logs WHERE timestamp < ?", [threeMonthsAgo]);
}

async function getEffectiveDevice(deviceId) {
    const device = await dbGet("SELECT * FROM devices WHERE id = ?", [deviceId]);
    if (!device) return null;

    try { device.playlist = JSON.parse(device.playlist || '[]'); } catch (e) { device.playlist = []; }
    device.isRegistered = !!device.isRegistered;

    if (device.campaignId) {
        const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [device.campaignId]);
        if (campaign) {
            device.campaign = { ...campaign, zonePlaylists: JSON.parse(campaign.zonePlaylists || '{}') };
            const layout = await dbGet("SELECT * FROM layouts WHERE id = ?", [campaign.layoutId]);
            if (layout) {
                device.layout = { ...layout, zones: JSON.parse(layout.zones || '[]') };
            }
        }
    } else if (device.groupId) {
        const group = await dbGet("SELECT * FROM groups WHERE id = ?", [device.groupId]);
        if (group) {
            device.groupName = group.name;
            
            // Inherit overlay if device doesn't have its own
            if (!device.overlay && group.overlay) {
                device.overlay = group.overlay;
                device.overlayX = group.overlayX;
                device.overlayY = group.overlayY;
                device.overlayW = group.overlayW;
                device.overlayH = group.overlayH;
            }

            if (group.campaignId && !device.campaignId) {
                // Inherit campaign from group if device doesn't have its own
                const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [group.campaignId]);
                if (campaign) {
                    device.campaign = { ...campaign, zonePlaylists: JSON.parse(campaign.zonePlaylists || '{}') };
                    const layout = await dbGet("SELECT * FROM layouts WHERE id = ?", [campaign.layoutId]);
                    if (layout) {
                        device.layout = { ...layout, zones: JSON.parse(layout.zones || '[]') };
                    }
                }
            } else if (!device.campaignId) {
                // Fallback to group playlist if no campaign set
                try { device.playlist = JSON.parse(group.playlist || '[]'); } catch (e) { device.playlist = []; }
            }
        }
    }
    // Compute a hash of the structured playlist to allow clients to skip downloading it if unchanged
    const hashData = device.campaign ? JSON.stringify({c: device.campaign, l: device.layout}) : JSON.stringify(device.playlist || []);
    device.playlistHash = crypto.createHash('md5').update(hashData).digest('hex');
    
    device.currentAssetId = device.currentAssetId || null;
    device.lastReloadTime = device.lastReloadTime || 0;
    return device;
}

// --- Middleware ---
const requireAuth = async (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    let session = sessions.get(token);
    if (!session) {
        try {
            const dbSession = await dbGet("SELECT * FROM sessions WHERE token = ?", [token]);
            if (dbSession) {
                session = {
                    id: dbSession.userId,
                    email: dbSession.email,
                    role: dbSession.role,
                    isTempPassword: !!dbSession.isTempPassword
                };
                sessions.set(token, session);
            }
        } catch (e) { }
    }

    if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = session;
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    next();
};

const rateLimitLogin = (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    const WINDOW_MS = 15 * 60 * 1000;
    const MAX_ATTEMPTS = 5;

    let record = loginAttempts.get(ip);
    if (!record) {
        record = { count: 0, firstAttempt: now };
        loginAttempts.set(ip, record);
    }

    if (now - record.firstAttempt > WINDOW_MS) {
        record.count = 0;
        record.firstAttempt = now;
    }

    if (record.count >= MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, message: "Too many login attempts. Please wait 15 minutes." });
    }

    req.rateLimit = record;
    next();
};

const normalizeContentType = (req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        req.headers['content-type'] = 'application/json';
    }
    next();
};

// --- APP 1: SCREEN SERVER (Port 8765) ---
const appScreen = express();
appScreen.use(cors());
appScreen.use(normalizeContentType);
appScreen.use(bodyParser.json({ limit: '1024mb' }));
appScreen.use(express.static(DIST_DIR, {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }
}));
appScreen.use('/uploads', express.static(UPLOADS_DIR));

const deviceLogs = new Map(); // deviceId -> string[]





appScreen.post('/api/device/init', async (req, res) => {
    const { deviceId, resolution, userAgent, playlistHash } = req.body;
    if (!deviceId) return res.status(400).json({ error: "No ID" });

    let device = await dbGet("SELECT * FROM devices WHERE id = ?", [deviceId]);

    if (!device) {
        const newDevice = {
            id: deviceId,
            name: `Display-${deviceId.substring(0, 4)}`,
            pairingCode: generatePairingCode(),
            isRegistered: 0,
            lastSeen: Date.now(),
            playlist: '[]',
            rotation: 0
        };
        await dbRun(
            "INSERT INTO devices (id, name, pairingCode, isRegistered, lastSeen, playlist, rotation, resolution, userAgent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [newDevice.id, newDevice.name, newDevice.pairingCode, 0, newDevice.lastSeen, '[]', 0, resolution || null, userAgent || null]
        );
    } else {
        const updates = ["lastSeen = ?"];
        const params = [Date.now()];
        if (resolution) { updates.push("resolution = ?"); params.push(resolution); }
        if (userAgent) { updates.push("userAgent = ?"); params.push(userAgent); }
        params.push(deviceId);
        await dbRun(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const effectiveDev = await getEffectiveDevice(deviceId);
    
    // Clear one-time reload signal after sending it to the initializing device
    if (effectiveDev && effectiveDev.lastReloadTime) {
        await dbRun("UPDATE devices SET lastReloadTime = NULL WHERE id = ?", [deviceId]);
    }

    if (playlistHash && effectiveDev.playlistHash === playlistHash) {
        // Bandwidth optimization: omit the heavy playlist if the client already has it
        effectiveDev.playlist = [];
        effectiveDev.playlistUnchanged = true;
    }

    res.json(effectiveDev);
});

appScreen.post('/api/devices/:id/logs', async (req, res) => {
    const { id } = req.params;
    const { logs } = req.body;

    if (Array.isArray(logs)) {
        const nowIso = new Date().toISOString();
        const formattedLogs = logs.map(l => {
            if (typeof l === 'string' && /^\[\d{4}-\d{2}-\d{2}/.test(l)) return l;
            return `[${nowIso}] ${l}`;
        });

        if (formattedLogs.length > 0) console.log(`[LOG-RECEIPT] Device ${id}:`, formattedLogs);

        const current = deviceLogs.get(id) || [];
        const updated = [...formattedLogs, ...current].slice(0, 100);
        deviceLogs.set(id, updated);
    }
    res.json({ success: true });
});

appScreen.get('/api/preview-campaign/:id', async (req, res) => {
    const { id } = req.params;
    const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [id]);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    try { campaign.zonePlaylists = JSON.parse(campaign.zonePlaylists || '{}'); } catch (e) { campaign.zonePlaylists = {}; }

    const layout = await dbGet("SELECT * FROM layouts WHERE id = ?", [campaign.layoutId]);
    if (layout) {
        try { layout.zones = JSON.parse(layout.zones || '[]'); } catch (e) { layout.zones = []; }
    }

    res.json({ ...campaign, layout });
});

appScreen.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });

    const indexPath = path.join(DIST_DIR, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`[SCREEN] Failed to serve index.html from ${indexPath}:`, err);
            res.status(500).send(`
                <h1>System Warning</h1>
                <p>The system is running, but the Frontend Interface (dist/index.html) could not be found.</p>
                <p><strong>Path searched:</strong> ${indexPath}</p>
                <p>Please ensure you have run <code>npm run build</code> on the server.</p>
                <pre>${err.message}</pre>
            `);
        }
    });
});

const serverScreen = http.createServer(appScreen);
const wss = new WebSocket.Server({ server: serverScreen });

const clients = new Map();
function heartbeat() { this.isAlive = true; }

wss.on('connection', (ws) => {
    let deviceId = null;
    ws.isAlive = true;
    ws.on('message', async (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'IDENTIFY') {
                deviceId = data.deviceId;
                clients.set(deviceId, ws);
                await dbRun("UPDATE devices SET lastSeen = ? WHERE id = ?", [Date.now(), deviceId]);
                const effective = await getEffectiveDevice(deviceId);
                if (effective) {
                    const payload = JSON.stringify({ type: 'UPDATE', device: effective });
                    console.log(`[WS-SEND] To ${deviceId}: ${payload.substring(0, 100)}`);
                    ws.send(payload);
                }
            } else if (data.type === 'REPORT_STATE') {
                const { currentAssetId } = data;
                if (deviceId && currentAssetId) {
                    console.log(`[STATE] Device ${deviceId} reporting asset: ${currentAssetId}`);
                    await dbRun("UPDATE devices SET currentAssetId = ?, lastSeen = ? WHERE id = ?", [currentAssetId, Date.now(), deviceId]);
                    
                    // Broadcast to all connected clients (Admins and other screens)
                    const updateMsg = JSON.stringify({ type: 'DEVICE_UPDATE', deviceId, currentAssetId });
                    let count = 0;
                    wss.clients.forEach(client => {
                        if (client.readyState === 1) { // 1 = OPEN
                            client.send(updateMsg);
                            count++;
                        }
                    });
                    console.log(`[STATE] Device ${deviceId} -> Asset ${currentAssetId}. Broadcasted to ${count} listeners.`);
                }
            }
        } catch (e) { }
    });
    ws.on('close', () => { if (deviceId) clients.delete(deviceId); });
});

setInterval(async () => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
    for (const [id, ws] of clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
            await dbRun("UPDATE devices SET lastSeen = ? WHERE id = ?", [Date.now(), id]);
        }
    }
}, 30000);

async function notifyDevice(id) {
    const ws = clients.get(id);
    const effective = await getEffectiveDevice(id);
    if (ws && ws.readyState === WebSocket.OPEN && effective) {
        const payload = JSON.stringify({ type: 'UPDATE', device: effective });
        console.log(`[WS-SEND] To ${id}: ${payload.substring(0, 100)}`);
        ws.send(payload);
    }
}

serverScreen.listen(SCREEN_PORT, () => {
    console.log(`[SCREEN] Server running on port ${SCREEN_PORT}`);
});


// --- APP 2: ADMIN DASHBOARD (Port 8766) ---
const appAdmin = express();
appAdmin.use(cors());
appAdmin.use(normalizeContentType);
appAdmin.use(bodyParser.json({ limit: '1024mb' }));
appAdmin.use(express.static(DIST_DIR));
appAdmin.use('/uploads', express.static(UPLOADS_DIR));

// Logs are shared between Screen and Admin ports
appAdmin.post('/api/devices/:id/logs', async (req, res) => {
    const { id } = req.params;
    const { logs } = req.body;

    if (Array.isArray(logs)) {
        const nowIso = new Date().toISOString();
        const formattedLogs = logs.map(l => {
            if (typeof l === 'string' && /^\[\d{4}-\d{2}-\d{2}/.test(l)) return l;
            return `[${nowIso}] ${l}`;
        });

        if (formattedLogs.length > 0) console.log(`[LOG-RECEIPT-ADMIN] Device ${id}:`, formattedLogs);

        const current = deviceLogs.get(id) || [];
        const updated = [...formattedLogs, ...current].slice(0, 100);
        deviceLogs.set(id, updated);
    }
    res.json({ success: true });
});

// 1. Auth API
appAdmin.post('/api/login', rateLimitLogin, async (req, res) => {
    const { email, password } = req.body;
    const user = await dbGet("SELECT * FROM users WHERE email = ? AND passwordHash = ?", [email, hashPassword(password)]);

    if (user) {
        if (req.rateLimit) req.rateLimit.count = 0;
        const token = crypto.randomBytes(32).toString('hex');

        // Check temp password flag
        const isTemp = !!user.isTempPassword;

        const sessionUser = { id: user.id, email: user.email, role: user.role, isTempPassword: isTemp };
        sessions.set(token, sessionUser);
        try {
            await dbRun(
                "INSERT OR REPLACE INTO sessions (token, userId, email, role, isTempPassword, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
                [token, user.id, user.email, user.role, isTemp ? 1 : 0, Date.now()]
            );
        } catch (e) { }
        logAudit(sessionUser, 'LOGIN', 'User logged in');

        // Return requirePasswordChange flag
        res.json({ success: true, token, user: sessionUser, requirePasswordChange: isTemp });
    } else {
        if (req.rateLimit) req.rateLimit.count++;
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

appAdmin.post('/api/logout', requireAuth, async (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
        sessions.delete(token);
        try { await dbRun("DELETE FROM sessions WHERE token = ?", [token]); } catch (e) { }
    }
    logAudit(req.user, 'LOGOUT', 'User logged out');
    res.json({ success: true });
});

// --- Google OAuth 2.0 API & Callback ---
appAdmin.get('/auth/google', (req, res) => {
    const clientId = systemConfig.googleClientId || '';
    const redirectUri = systemConfig.googleRedirectUri || `${req.protocol}://${req.get('host')}/auth/google_oauth2/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state: state
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

appAdmin.get('/api/auth/google/url', (req, res) => {
    const clientId = systemConfig.googleClientId || '';
    const redirectUri = systemConfig.googleRedirectUri || `${req.protocol}://${req.get('host')}/auth/google_oauth2/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state: state
    });

    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

appAdmin.get('/auth/google_oauth2/callback', async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
        console.error('[GOOGLE OAUTH ERROR]', error, error_description);
        return res.redirect(`/?login_error=${encodeURIComponent(error_description || 'Google authentication cancelled.')}`);
    }

    if (!code) {
        return res.redirect(`/?login_error=${encodeURIComponent('Authorization code not provided by Google.')}`);
    }

    const clientId = systemConfig.googleClientId || '';
    const clientSecret = systemConfig.googleClientSecret || '';
    const redirectUri = systemConfig.googleRedirectUri || `${req.protocol}://${req.get('host')}/auth/google_oauth2/callback`;

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: String(code),
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }).toString()
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            console.error('[GOOGLE TOKEN EXCHANGE FAILED]', tokenData);
            return res.redirect(`/?login_error=${encodeURIComponent('Failed to validate credentials with Google.')}`);
        }

        // Fetch user profile from Google
        const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const googleUser = await userinfoResponse.json();
        if (!googleUser || !googleUser.email) {
            console.error('[GOOGLE USERINFO FAILED]', googleUser);
            return res.redirect(`/?login_error=${encodeURIComponent('Unable to retrieve email from Google account.')}`);
        }

        const email = googleUser.email.toLowerCase().trim();

        // Check if user exists in database
        let user = await dbGet("SELECT * FROM users WHERE LOWER(email) = ?", [email]);

        if (!user) {
            const allowedDomain = process.env.ALLOWED_OAUTH_DOMAIN || systemConfig.allowedOAuthDomain || '';
            const isAllowedDomain = allowedDomain && email.endsWith(`@${allowedDomain}`);
            const isRootAdmin = email === 'admin@storecast.com';

            if (isAllowedDomain || isRootAdmin) {
                const id = Date.now().toString();
                const role = (isRootAdmin || email.startsWith('admin')) ? 'ADMIN' : 'OWNER';
                await dbRun(
                    "INSERT INTO users (id, email, passwordHash, role, createdAt, isTempPassword) VALUES (?, ?, ?, ?, ?, ?)",
                    [id, email, '', role, Date.now(), 0]
                );
                user = await dbGet("SELECT * FROM users WHERE id = ?", [id]);
                logAudit(user, 'CREATE_USER', `Auto-registered user via Google OAuth: ${email} (${role})`);
            } else {
                logAudit(null, 'LOGIN_FAILED', `Unauthorized Google OAuth attempt: ${email}`);
                return res.redirect(`/?login_error=${encodeURIComponent(`Unauthorized access for ${email}. Please contact an administrator.`)}`);
            }
        }

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const sessionUser = { id: user.id, email: user.email, role: user.role, isTempPassword: false };
        sessions.set(token, sessionUser);
        try {
            await dbRun(
                "INSERT OR REPLACE INTO sessions (token, userId, email, role, isTempPassword, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
                [token, user.id, user.email, user.role, 0, Date.now()]
            );
        } catch (e) { }

        logAudit(sessionUser, 'LOGIN', `User logged in via Google OAuth (${email})`);

        // Serve HTML bridge that writes credentials to localStorage & cookie, then redirects to /
        res.setHeader('Content-Type', 'text/html');
        return res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Store Cast - Connecting...</title>
    <style>
        body { background-color: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; }
        .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        p { color: #94a3b8; font-size: 14px; }
    </style>
</head>
<body>
    <div style="text-align: center;">
        <div class="spinner"></div>
        <p>Authenticated successfully. Redirecting...</p>
    </div>
    <script>
        try {
            const token = ${JSON.stringify(token)};
            const user = ${JSON.stringify(sessionUser)};
            localStorage.setItem('storecast_token', token);
            localStorage.setItem('storecast_user_info', JSON.stringify(user));
            document.cookie = 'storecast_token=' + token + '; path=/; max-age=2592000; SameSite=Lax';
            document.cookie = 'storecast_user_info=' + encodeURIComponent(JSON.stringify(user)) + '; path=/; max-age=2592000; SameSite=Lax';
        } catch (e) {
            console.error('Storage error:', e);
        }
        window.location.replace('/');
    </script>
</body>
</html>`);
    } catch (err) {
        console.error('[GOOGLE AUTH EXCEPTION]', err);
        return res.redirect(`/?login_error=${encodeURIComponent('Internal error during Google authentication.')}`);
    }
});



appAdmin.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (user) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        resetTokens.set(email, { code, expires: Date.now() + 15 * 60 * 1000 });

        await sendEmail(email, "Password Recovery - Store Cast", `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Password Recovery</h2>
                <p>You requested to reset your password. Use the code below:</p>
                <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a;">${code}</span>
                </div>
                <p>This code expires in 15 minutes.</p>
                <p style="color: #64748b; font-size: 12px; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
            </div>
        `);
    }
    // Always return success to prevent email enumeration
    res.json({ success: true });
});

appAdmin.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const tokenData = resetTokens.get(email);

    if (!tokenData) return res.status(400).json({ error: "Invalid or expired request" });
    if (Date.now() > tokenData.expires) {
        resetTokens.delete(email);
        return res.status(400).json({ error: "Code expired" });
    }
    if (tokenData.code !== code) {
        return res.status(400).json({ error: "Invalid code" });
    }

    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (user) {
        // Resetting password clears the Temp Password flag
        await dbRun("UPDATE users SET passwordHash = ?, isTempPassword = 0 WHERE email = ?", [hashPassword(newPassword), email]);
        resetTokens.delete(email);
        logAudit(user, 'RESET_PASSWORD', 'User reset password via recovery code');
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

appAdmin.put('/api/profile/password', requireAuth, async (req, res) => {
    const { newPassword } = req.body;
    // Changing password clears the Temp Password flag
    await dbRun("UPDATE users SET passwordHash = ?, isTempPassword = 0 WHERE id = ?", [hashPassword(newPassword), req.user.id]);

    // Update session
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (sessions.has(token)) {
        sessions.get(token).isTempPassword = false;
    }

    logAudit(req.user, 'PASSWORD_CHANGE', 'User changed their password');
    res.json({ success: true });
});

// 2. User Management (Admin Only)
appAdmin.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const users = await dbAll("SELECT id, email, role, createdAt FROM users");
    res.json(users);
});

appAdmin.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { email, role } = req.body;
    const existing = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const tempPassword = generateTempPassword();
    const id = Date.now().toString();

    // Set isTempPassword = 1
    await dbRun("INSERT INTO users (id, email, passwordHash, role, createdAt, isTempPassword) VALUES (?, ?, ?, ?, ?, ?)",
        [id, email, hashPassword(tempPassword), role, Date.now(), 1]
    );

    // Send Email
    await sendEmail(email, "Welcome to Store Cast", `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Welcome to Store Cast</h2>
            <p>An account has been created for you.</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0;"><strong>Temporary Password:</strong></p>
                <p style="font-family: monospace; font-size: 24px; font-weight: bold; background: #e2e8f0; display: inline-block; padding: 8px 16px; border-radius: 4px; letter-spacing: 2px;">${tempPassword}</p>
            </div>
            <p>You will be required to change this password upon your first login.</p>
        </div>
    `);

    logAudit(req.user, 'CREATE_USER', `Created user ${email} as ${role}`);
    res.json({ success: true });
});

appAdmin.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [id]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.email === 'admin@storecast.com') return res.status(403).json({ error: "Cannot modify root admin" });

    const { role } = req.body;
    if (role) {
        await dbRun("UPDATE users SET role = ? WHERE id = ?", [role, id]);
    }
    logAudit(req.user, 'UPDATE_USER', `Updated user ${user.email} role to ${role}`);
    res.json({ success: true });
});

appAdmin.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    if (req.params.id === 'admin') return res.status(400).json({ error: "Cannot delete root admin" });

    await dbRun("DELETE FROM users WHERE id = ?", [req.params.id]);
    logAudit(req.user, 'DELETE_USER', `Deleted user ${req.params.id}`);
    res.json({ success: true });
});

// 3. System Config & Logs
appAdmin.get('/api/config', requireAuth, requireAdmin, (req, res) => {
    res.json(systemConfig);
});

appAdmin.put('/api/config', requireAuth, requireAdmin, (req, res) => {
    systemConfig = { ...systemConfig, ...req.body };
    saveConfig();
    // Re-init mailer if config changes
    initMailer();
    logAudit(req.user, 'UPDATE_CONFIG', `Updated system config`);
    res.json({ success: true });
});

appAdmin.get('/api/audit', requireAuth, requireAdmin, async (req, res) => {
    const logs = await dbAll("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500");
    res.json(logs);
});

async function hydrateDevicesBatch(devicesList) {
    const [campaignsList, layoutsList, groupsList] = await Promise.all([
        dbAll("SELECT * FROM campaigns"),
        dbAll("SELECT * FROM layouts"),
        dbAll("SELECT * FROM groups")
    ]);

    const campaigns = new Map(campaignsList.map(c => [c.id, c]));
    const layouts = new Map(layoutsList.map(l => [l.id, l]));
    const groups = new Map(groupsList.map(g => [g.id, g]));

    return devicesList.map(device => {
        const d = { ...device };
        try { d.playlist = JSON.parse(d.playlist || '[]'); } catch (e) { d.playlist = []; }
        d.isRegistered = !!d.isRegistered;

        let campaignId = d.campaignId;
        let group = null;

        if (d.groupId && groups.has(d.groupId)) {
            group = groups.get(d.groupId);
            d.groupName = group.name;

            if (!d.overlay && group.overlay) {
                d.overlay = group.overlay;
                d.overlayX = group.overlayX;
                d.overlayY = group.overlayY;
                d.overlayW = group.overlayW;
                d.overlayH = group.overlayH;
            }

            if (group.campaignId && !d.campaignId) {
                campaignId = group.campaignId;
            } else if (!d.campaignId) {
                try { d.playlist = JSON.parse(group.playlist || '[]'); } catch (e) { d.playlist = []; }
            }
        }

        if (campaignId && campaigns.has(campaignId)) {
            const campaign = campaigns.get(campaignId);
            d.campaign = { ...campaign, zonePlaylists: JSON.parse(campaign.zonePlaylists || '{}') };
            if (campaign.layoutId && layouts.has(campaign.layoutId)) {
                const layout = layouts.get(campaign.layoutId);
                d.layout = { ...layout, zones: JSON.parse(layout.zones || '[]') };
            }
        }

        const hashData = d.campaign ? JSON.stringify({c: d.campaign, l: d.layout}) : JSON.stringify(d.playlist || []);
        d.playlistHash = crypto.createHash('md5').update(hashData).digest('hex');

        d.currentAssetId = d.currentAssetId || null;
        d.lastReloadTime = d.lastReloadTime || 0;
        return d;
    });
}

// 4. Device Management
appAdmin.get('/api/devices', requireAuth, async (req, res) => {
    let devices;
    if (req.user.role === 'ADMIN') {
        devices = await dbAll("SELECT * FROM devices");
    } else {
        devices = await dbAll("SELECT * FROM devices WHERE ownerId = ?", [req.user.id]);
    }

    const hydratedDevices = await hydrateDevicesBatch(devices);
    res.json(hydratedDevices);
});

appAdmin.post('/api/register', requireAuth, async (req, res) => {
    const { pairingCode, name } = req.body;

    const duplicate = await dbGet("SELECT * FROM devices WHERE ownerId = ? AND lower(name) = lower(?)", [req.user.id, name.trim()]);
    if (duplicate) {
        return res.status(400).json({ success: false, message: "A device with this name already exists." });
    }

    const device = await dbGet("SELECT * FROM devices WHERE pairingCode = ? AND isRegistered = 0", [pairingCode]);

    if (device) {
        await dbRun("UPDATE devices SET isRegistered = 1, name = ?, ownerId = ? WHERE id = ?",
            [name, req.user.id, device.id]
        );
        notifyDevice(device.id);
        logAudit(req.user, 'REGISTER_DEVICE', `Registered device ${name} (${device.id})`);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Invalid pairing code" });
    }
});

appAdmin.delete('/api/devices/:id', requireAuth, async (req, res) => {
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [req.params.id]);
    if (!dev) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && dev.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await dbRun("DELETE FROM devices WHERE id = ?", [dev.id]);
    logAudit(req.user, 'DELETE_DEVICE', `Deleted device ${dev.name} (${dev.id})`);
    res.json({ success: true });
});

appAdmin.get('/api/devices/:id/logs', requireAuth, (req, res) => {
    const logs = deviceLogs.get(req.params.id) || [];
    res.json({ logs });
});

appAdmin.post('/api/devices/:id/refresh', requireAuth, async (req, res) => {
    const { id } = req.params;
    const now = Date.now();
    
    // 1. Update DB for Polling-based Refresh (Robust)
    await dbRun("UPDATE devices SET lastReloadTime = ? WHERE id = ?", [now, id]);
    console.log(`[REFRESH] DB updated for device ${id} by user ${req.user.email} (Timestamp: ${now})`);

    // 2. Also try WebSocket if connected (Legacy/Fast fallback)
    const ws = clients.get(id);
    if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({ type: 'RELOAD', id: now.toString() });
        ws.send(payload);
    }
    
    res.json({ success: true });
});

appAdmin.get('/api/preview-campaign/:id', async (req, res) => {
    const { id } = req.params;
    const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [id]);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    try { campaign.zonePlaylists = JSON.parse(campaign.zonePlaylists || '{}'); } catch (e) { campaign.zonePlaylists = {}; }

    const layout = await dbGet("SELECT * FROM layouts WHERE id = ?", [campaign.layoutId]);
    if (layout) {
        try { layout.zones = JSON.parse(layout.zones || '[]'); } catch (e) { layout.zones = []; }
    }

    res.json({ ...campaign, layout });
});

function getFfmpegBin() {
    try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
    } catch (e) {}
    return 'ffmpeg';
}

function extractBase64ToFile(content, name) {
    if (!content || typeof content !== 'string' || !content.startsWith('data:')) {
        return content;
    }
    const commaIdx = content.indexOf(',');
    if (commaIdx === -1) return content;
    
    const header = content.substring(0, commaIdx);
    const base64Data = content.substring(commaIdx + 1);
    const buffer = Buffer.from(base64Data, 'base64');
    
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = (mimeMatch ? mimeMatch[1] : 'application/octet-stream').trim().toLowerCase();
    
    let ext = 'bin';
    if (mime.includes('/')) ext = mime.split('/')[1];
    ext = ext.split(';')[0].trim().toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'quicktime') ext = 'mov';
    
    const isVideo = mime.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);
    const id = crypto.randomUUID();
    
    if (isVideo) {
        const rawFilename = `raw_${id}.${ext === 'quicktime' ? 'mov' : ext}`;
        const rawPath = path.join(UPLOADS_DIR, rawFilename);
        const finalFilename = `${id}.mp4`;
        const finalPath = path.join(UPLOADS_DIR, finalFilename);
        
        try {
            fs.writeFileSync(rawPath, buffer);
            console.log(`[FFMPEG] Auto-extracting & optimizing 1080p video: ${name || finalFilename}`);
            const ffmpegCmd = `"${getFfmpegBin()}" -y -i "${rawPath}" -vf "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',format=yuv420p" -r 30 -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -maxrate 3500k -bufsize 5000k -tune fastdecode -c:a aac -b:a 128k -movflags +faststart "${finalPath}"`;
            exec(ffmpegCmd, (err) => {
                if (fs.existsSync(rawPath)) try { fs.unlinkSync(rawPath); } catch(e){}
                if (err || !fs.existsSync(finalPath)) {
                    fs.writeFileSync(finalPath, buffer);
                }
            });
            return `/uploads/${finalFilename}`;
        } catch(e) {
            fs.writeFileSync(finalPath, buffer);
            if (fs.existsSync(rawPath)) try { fs.unlinkSync(rawPath); } catch(e){}
            return `/uploads/${finalFilename}`;
        }
    } else {
        const filename = `${id}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filepath, buffer);
        console.log(`[UPLOAD] Auto-extracted base64 image: ${name || filename}`);
        return `/uploads/${filename}`;
    }
}

function sanitizeAssetList(assets) {
    if (!Array.isArray(assets)) return [];
    return assets.map(a => {
        if (a && a.url && a.url.startsWith('data:')) {
            return { ...a, url: extractBase64ToFile(a.url, a.name) };
        }
        return a;
    });
}

function sanitizeZonePlaylists(zonePlaylists) {
    if (!zonePlaylists || typeof zonePlaylists !== 'object') return {};
    const sanitized = {};
    Object.keys(zonePlaylists).forEach(zoneKey => {
        sanitized[zoneKey] = sanitizeAssetList(zonePlaylists[zoneKey]);
    });
    return sanitized;
}

appAdmin.put('/api/devices/:id/playlist', requireAuth, async (req, res) => {
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [req.params.id]);
    if (!dev) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN') {
        if (dev.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
        if (!systemConfig.allowOwnerEdit) return res.status(403).json({ error: "Editing currently disabled by Admin" });
    }

    const { playlist } = req.body;
    const sanitized = sanitizeAssetList(playlist || []);
    const playlistStr = JSON.stringify(sanitized);

    await dbRun("UPDATE devices SET playlist = ? WHERE id = ?", [playlistStr, dev.id]);

    if (!dev.groupId) notifyDevice(dev.id);
    logAudit(req.user, 'UPDATE_PLAYLIST', `Updated playlist for ${dev.name}.`);
    res.json({ success: true });
});

// 2. Upload API
appAdmin.post('/api/upload', requireAuth, (req, res) => {
    console.log(`[UPLOAD-DEBUG] Request headers:`, req.headers);
    console.log(`[UPLOAD-DEBUG] Body keys:`, req.body ? Object.keys(req.body) : 'no body');
    const { content, name } = req.body;
    if (!content || !content.startsWith('data:')) {
        return res.status(400).json({ error: "Invalid upload content" });
    }

    const commaIdx = content.indexOf(',');
    if (commaIdx === -1) {
        return res.status(400).json({ error: "Invalid upload content format" });
    }

    const header = content.substring(0, commaIdx);
    const base64Data = content.substring(commaIdx + 1);
    const buffer = Buffer.from(base64Data, 'base64');

    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = (mimeMatch ? mimeMatch[1] : 'application/octet-stream').trim().toLowerCase();

    let ext = 'bin';
    if (mime.includes('/')) {
        ext = mime.split('/')[1];
    }
    ext = ext.split(';')[0].trim().toLowerCase();

    const isVideo = mime.startsWith('video/') || ['mp4', 'mov', 'quicktime', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);

    if (isVideo) {
        const tempId = crypto.randomUUID();
        const rawFilename = `raw_${tempId}.${ext === 'quicktime' ? 'mov' : ext}`;
        const rawPath = path.join(UPLOADS_DIR, rawFilename);
        const finalFilename = `${tempId}.mp4`;
        const finalPath = path.join(UPLOADS_DIR, finalFilename);

        try {
            fs.writeFileSync(rawPath, buffer);
            console.log(`[FFMPEG] Transcoding video to optimized 1080p TV H.264 MP4: ${rawPath} -> ${finalPath}`);

            const ffmpegCmd = `"${getFfmpegBin()}" -y -i "${rawPath}" -vf "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',format=yuv420p" -r 30 -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -maxrate 3500k -bufsize 5000k -tune fastdecode -c:a aac -b:a 128k -movflags +faststart "${finalPath}"`;
            exec(ffmpegCmd, (err, stdout, stderr) => {
                if (fs.existsSync(rawPath)) {
                    try { fs.unlinkSync(rawPath); } catch (e) {}
                }

                if (err || !fs.existsSync(finalPath)) {
                    console.error("[FFMPEG] Transcoding failed, fallback to raw save:", err || stderr);
                    fs.writeFileSync(finalPath, buffer);
                }

                logAudit(req.user, 'UPLOAD_ASSET', `Uploaded & transcoded video ${name || finalFilename}`);
                res.json({ success: true, url: `/uploads/${finalFilename}`, name: name || finalFilename, transcoded: true });
            });
        } catch (e) {
            console.error("Upload error:", e);
            res.status(500).json({ error: "Upload failed: " + e.message });
        }
        return;
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    try {
        fs.writeFileSync(filepath, buffer);
        logAudit(req.user, 'UPLOAD_ASSET', `Uploaded asset ${name || filename}`);
        res.json({ success: true, url: `/uploads/${filename}`, name: name || filename });
    } catch (e) {
        console.error("Upload error:", e);
        res.status(500).json({ error: "Upload failed: " + e.message });
    }
});

// Stateless Utils Route for Base64 or Path Video Rotation
appAdmin.post('/api/utils/rotate', requireAuth, (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: "Missing video content" });
    }

    let inputPath = '';
    let outputPath = '';
    let isPath = false;
    const tempId = crypto.randomUUID();

    if (content.startsWith('/uploads/')) {
        isPath = true;
        const filename = path.basename(content);
        inputPath = path.join(UPLOADS_DIR, filename);
        outputPath = path.join(UPLOADS_DIR, `rotated_${tempId}.mp4`);
    } else if (content.startsWith('data:video/')) {
        const commaIdx = content.indexOf(',');
        if (commaIdx === -1) {
            return res.status(400).json({ error: "Invalid base64 string" });
        }
        const header = content.substring(0, commaIdx);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
        const ext = mime.split('/')[1] || 'mp4';
        const buffer = Buffer.from(content.substring(commaIdx + 1), 'base64');
        inputPath = path.join(UPLOADS_DIR, `temp_${tempId}.${ext}`);
        outputPath = path.join(UPLOADS_DIR, `rotated_${tempId}.mp4`);
        fs.writeFileSync(inputPath, buffer);
    } else {
        return res.status(400).json({ error: "Invalid video content format" });
    }

    console.log(`[FFMPEG] Rotating video file: ${inputPath} -> ${outputPath}`);
    exec(`"${getFfmpegBin()}" -y -i "${inputPath}" -vf "transpose=1" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -c:a copy -movflags +faststart "${outputPath}"`, (err) => {
        if (err || !fs.existsSync(outputPath)) {
            console.error("Rotation Util Error:", err);
            if (!isPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            return res.status(500).json({ error: "Rotation failed" });
        }

        if (isPath) {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            const newFilename = path.basename(outputPath);
            logAudit(req.user, 'ROTATE_VIDEO_UTIL', `Rotated video file ${path.basename(content)}`);
            res.json({ success: true, content: `/uploads/${newFilename}` });
        } else {
            const rotatedBuffer = fs.readFileSync(outputPath);
            const rotatedBase64 = `data:video/mp4;base64,${rotatedBuffer.toString('base64')}`;
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            logAudit(req.user, 'ROTATE_VIDEO_UTIL', 'Rotated video base64 content');
            res.json({ success: true, content: rotatedBase64 });
        }
    });
});

appAdmin.put('/api/devices/:id', requireAuth, async (req, res) => {
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [req.params.id]);
    if (!dev) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN') {
        if (dev.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
        if (!systemConfig.allowOwnerEdit) return res.status(403).json({ error: "Editing currently disabled by Admin" });
    }

    const { name, rotation, overlay, overlayX, overlayY, overlayW, overlayH } = req.body;
    let newName = dev.name;
    let newRotation = dev.rotation;

    if (name) {
        const duplicate = await dbGet("SELECT * FROM devices WHERE ownerId = ? AND id != ? AND lower(name) = lower(?)", [dev.ownerId, dev.id, name.trim()]);
        if (duplicate) return res.status(400).json({ error: "A device with this name already exists." });
        newName = name;
    }
    if (typeof rotation === 'number') newRotation = rotation;

    let newOverlay = dev.overlay;
    if (overlay !== undefined) newOverlay = overlay;

    await dbRun(`UPDATE devices SET 
        name = ?, rotation = ?, overlay = ?, 
        overlayX = ?, overlayY = ?, overlayW = ?, overlayH = ? 
        WHERE id = ?`, 
        [
            newName, newRotation, newOverlay, 
            overlayX ?? dev.overlayX, overlayY ?? dev.overlayY, 
            overlayW ?? dev.overlayW, overlayH ?? dev.overlayH, 
            dev.id
        ]
    );

    notifyDevice(dev.id);
    logAudit(req.user, 'UPDATE_DEVICE', `Updated details for ${newName}`);
    res.json({ success: true });
});

appAdmin.put('/api/devices/:id/owner', requireAuth, requireAdmin, async (req, res) => {
    const { ownerId } = req.body;
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [req.params.id]);
    if (!dev) return res.status(404).json({ error: "Not found" });

    const newOwner = await dbGet("SELECT * FROM users WHERE id = ?", [ownerId]);
    if (!newOwner) return res.status(400).json({ error: "Owner not found" });

    await dbRun("UPDATE devices SET ownerId = ? WHERE id = ?", [ownerId, dev.id]);
    logAudit(req.user, 'CHANGE_OWNER', `Assigned ${dev.name} to ${newOwner.email}`);
    res.json({ success: true });
});

// 5. Group Management
appAdmin.get('/api/groups', requireAuth, async (req, res) => {
    let groups;
    if (req.user.role === 'ADMIN') {
        groups = await dbAll("SELECT * FROM groups");
    } else {
        groups = await dbAll("SELECT * FROM groups WHERE ownerId = ?", [req.user.id]);
    }
    res.json(groups.map(g => ({ ...g, playlist: JSON.parse(g.playlist || '[]') })));
});

appAdmin.post('/api/groups', requireAuth, async (req, res) => {
    const { name } = req.body;

    const duplicate = await dbGet("SELECT * FROM groups WHERE ownerId = ? AND lower(name) = lower(?)", [req.user.id, name.trim()]);
    if (duplicate) return res.status(400).json({ error: "A group with this name already exists." });

    const id = Date.now().toString();
    await dbRun("INSERT INTO groups (id, name, playlist, campaignId, ownerId) VALUES (?, ?, ?, ?, ?)",
        [id, name, '[]', null, req.user.id]
    );

    const newGroup = await dbGet("SELECT * FROM groups WHERE id = ?", [id]);
    newGroup.playlist = JSON.parse(newGroup.playlist || '[]');

    logAudit(req.user, 'CREATE_GROUP', `Created group ${name}`);
    res.json(newGroup);
});

appAdmin.put('/api/groups/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const group = await dbGet("SELECT * FROM groups WHERE id = ?", [id]);
    if (!group) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && group.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const { name, overlay, overlayX, overlayY, overlayW, overlayH } = req.body;
    let newName = group.name;
    if (name) {
        const duplicate = await dbGet("SELECT * FROM groups WHERE ownerId = ? AND id != ? AND lower(name) = lower(?)", [group.ownerId, group.id, name.trim()]);
        if (duplicate) return res.status(400).json({ error: "A group with this name already exists." });
        newName = name;
    }

    await dbRun(`UPDATE groups SET 
        name = ?, overlay = ?, 
        overlayX = ?, overlayY = ?, overlayW = ?, overlayH = ? 
        WHERE id = ?`,
        [
            newName, overlay ?? group.overlay,
            overlayX ?? group.overlayX, overlayY ?? group.overlayY,
            overlayW ?? group.overlayW, overlayH ?? group.overlayH,
            id
        ]
    );

    // Notify all devices in this group
    const devicesInGroup = await dbAll("SELECT * FROM devices WHERE groupId = ?", [id]);
    devicesInGroup.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'UPDATE_GROUP_SETTINGS', `Updated settings for group ${newName}`);
    res.json({ success: true });
});

appAdmin.put('/api/groups/:id/playlist', requireAuth, async (req, res) => {
    const { id } = req.params;
    const group = await dbGet("SELECT * FROM groups WHERE id = ?", [id]);

    if (!group) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && group.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const sanitized = sanitizeAssetList(req.body.playlist || []);
    const playlistStr = JSON.stringify(sanitized);
    await dbRun("UPDATE groups SET playlist = ? WHERE id = ?", [playlistStr, id]);

    const devicesInGroup = await dbAll("SELECT * FROM devices WHERE groupId = ?", [id]);
    devicesInGroup.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'UPDATE_GROUP', `Updated playlist for group ${group.name}`);
    res.json({ success: true });
});

appAdmin.put('/api/groups/:id/campaign', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { campaignId } = req.body;
    const group = await dbGet("SELECT * FROM groups WHERE id = ?", [id]);

    if (!group) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && group.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    if (campaignId) {
        const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [campaignId]);
        if (!campaign) return res.status(404).json({ error: "Campaign not found" });
        if (req.user.role !== 'ADMIN' && campaign.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden: Not your campaign" });
    }

    await dbRun("UPDATE groups SET campaignId = ? WHERE id = ?", [campaignId || null, id]);

    // Notify all devices in this group
    const devicesInGroup = await dbAll("SELECT * FROM devices WHERE groupId = ?", [id]);
    devicesInGroup.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'ASSIGN_CAMPAIGN_GROUP', `Assigned group ${group.name} to campaign ${campaignId || 'None'}`);
    res.json({ success: true });
});

appAdmin.put('/api/devices/:id/group', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { groupId } = req.body;
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [id]);

    if (!dev) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN') {
        if (dev.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden: Not your device" });
        if (groupId) {
            const group = await dbGet("SELECT * FROM groups WHERE id = ?", [groupId]);
            if (!group || group.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden: Not your group" });
        }
    }

    await dbRun("UPDATE devices SET groupId = ? WHERE id = ?", [groupId || null, id]);

    notifyDevice(id);
    logAudit(req.user, 'ASSIGN_GROUP', `Assigned device ${dev.name} to group ${groupId || 'None'}`);
    res.json({ success: true });
});

appAdmin.delete('/api/groups/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const group = await dbGet("SELECT * FROM groups WHERE id = ?", [id]);

    if (!group) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && group.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await dbRun("DELETE FROM groups WHERE id = ?", [id]);
    const devices = await dbAll("SELECT * FROM devices WHERE groupId = ?", [id]);
    await dbRun("UPDATE devices SET groupId = NULL WHERE groupId = ?", [id]);
    devices.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'DELETE_GROUP', `Deleted group ${group.name}`);
    res.json({ success: true });
});

// Added missing Group Update route
appAdmin.put('/api/groups/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const group = await dbGet("SELECT * FROM groups WHERE id = ?", [id]);

    if (!group) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && group.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const { name, overlay } = req.body;
    let newName = group.name;
    let newOverlay = group.overlay;

    if (name) {
        const duplicate = await dbGet("SELECT * FROM groups WHERE ownerId = ? AND id != ? AND lower(name) = lower(?)", [group.ownerId, group.id, name.trim()]);
        if (duplicate) return res.status(400).json({ error: "A group with this name already exists." });
        newName = name;
    }

    if (overlay !== undefined) newOverlay = overlay;

    await dbRun("UPDATE groups SET name = ?, overlay = ? WHERE id = ?", [newName, newOverlay, id]);

    // Notify all devices in this group of the change
    const devices = await dbAll("SELECT * FROM devices WHERE groupId = ?", [id]);
    devices.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'UPDATE_GROUP', `Updated details for group ${newName}`);
    res.json({ success: true });
});

// 6. Layouts
appAdmin.get('/api/layouts', requireAuth, async (req, res) => {
    const layouts = await dbAll("SELECT * FROM layouts");
    res.json(layouts.map(l => ({ ...l, zones: JSON.parse(l.zones || '[]'), isSystem: !!l.isSystem })));
});

appAdmin.post('/api/layouts', requireAuth, requireAdmin, async (req, res) => {
    const { name, zones } = req.body;
    const id = Date.now().toString();
    await dbRun("INSERT INTO layouts (id, name, zones, isSystem) VALUES (?, ?, ?, 0)", [id, name, JSON.stringify(zones)]);
    logAudit(req.user, 'CREATE_LAYOUT', `Created layout ${name}`);
    const newLayout = await dbGet("SELECT * FROM layouts WHERE id = ?", [id]);
    res.json({ ...newLayout, zones: JSON.parse(newLayout.zones), isSystem: !!newLayout.isSystem });
});

appAdmin.put('/api/layouts/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, zones } = req.body;
    const layout = await dbGet("SELECT * FROM layouts WHERE id = ?", [id]);
    if (!layout) return res.status(404).json({ error: "Not found" });
    if (layout.isSystem) return res.status(403).json({ error: "Cannot modify system layout" });

    await dbRun("UPDATE layouts SET name = ?, zones = ? WHERE id = ?", [name || layout.name, zones ? JSON.stringify(zones) : layout.zones, id]);
    logAudit(req.user, 'UPDATE_LAYOUT', `Updated layout ${name || layout.name}`);
    res.json({ success: true });
});

appAdmin.delete('/api/layouts/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const layout = await dbGet("SELECT * FROM layouts WHERE id = ?", [id]);
    if (!layout) return res.status(404).json({ error: "Not found" });
    if (layout.isSystem) return res.status(403).json({ error: "Cannot delete system layout" });

    // Ensure no campaigns are using this layout
    const activeCampaigns = await dbAll("SELECT * FROM campaigns WHERE layoutId = ?", [id]);
    if (activeCampaigns.length > 0) return res.status(400).json({ error: "Layout is currently used by campaigns" });

    await dbRun("DELETE FROM layouts WHERE id = ?", [id]);
    logAudit(req.user, 'DELETE_LAYOUT', `Deleted layout ${layout.name}`);
    res.json({ success: true });
});

// 7. Campaigns
appAdmin.get('/api/campaigns', requireAuth, async (req, res) => {
    let campaigns;
    if (req.user.role === 'ADMIN') {
        campaigns = await dbAll("SELECT * FROM campaigns");
    } else {
        campaigns = await dbAll("SELECT * FROM campaigns WHERE ownerId = ?", [req.user.id]);
    }
    res.json(campaigns.map(c => ({ ...c, zonePlaylists: JSON.parse(c.zonePlaylists || '{}') })));
});

appAdmin.post('/api/campaigns', requireAuth, async (req, res) => {
    const { name, layoutId, zonePlaylists } = req.body;
    const id = Date.now().toString();
    const sanitizedZP = sanitizeZonePlaylists(zonePlaylists || {});
    await dbRun("INSERT INTO campaigns (id, name, layoutId, zonePlaylists, ownerId) VALUES (?, ?, ?, ?, ?)", [id, name, layoutId, JSON.stringify(sanitizedZP), req.user.id]);
    logAudit(req.user, 'CREATE_CAMPAIGN', `Created campaign ${name}`);
    const newCampaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [id]);
    res.json({ ...newCampaign, zonePlaylists: sanitizedZP });
});

appAdmin.put('/api/campaigns/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, zonePlaylists, layoutId } = req.body;
    const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [id]);
    if (!campaign) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && campaign.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const sanitizedZP = zonePlaylists ? sanitizeZonePlaylists(zonePlaylists) : null;
    await dbRun("UPDATE campaigns SET name = ?, zonePlaylists = ?, layoutId = ? WHERE id = ?", 
        [name || campaign.name, sanitizedZP ? JSON.stringify(sanitizedZP) : campaign.zonePlaylists, layoutId || campaign.layoutId, id]);
    
    // Notify devices using this campaign
    const devices = await dbAll("SELECT * FROM devices WHERE campaignId = ?", [id]);
    devices.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'UPDATE_CAMPAIGN', `Updated campaign ${name || campaign.name}`);
    res.json({ success: true });
});

appAdmin.delete('/api/campaigns/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [id]);
    if (!campaign) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && campaign.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await dbRun("DELETE FROM campaigns WHERE id = ?", [id]);
    // Clear campaignId from devices
    const devices = await dbAll("SELECT * FROM devices WHERE campaignId = ?", [id]);
    await dbRun("UPDATE devices SET campaignId = NULL WHERE campaignId = ?", [id]);
    devices.forEach(d => notifyDevice(d.id));

    logAudit(req.user, 'DELETE_CAMPAIGN', `Deleted campaign ${campaign.name}`);
    res.json({ success: true });
});

appAdmin.put('/api/devices/:id/campaign', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { campaignId } = req.body;
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [id]);

    if (!dev) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN') {
        if (dev.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden: Not your device" });
        if (campaignId) {
            const campaign = await dbGet("SELECT * FROM campaigns WHERE id = ?", [campaignId]);
            if (!campaign || campaign.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden: Not your campaign" });
        }
    }

    await dbRun("UPDATE devices SET campaignId = ? WHERE id = ?", [campaignId || null, id]);
    notifyDevice(id);
    logAudit(req.user, 'ASSIGN_CAMPAIGN', `Assigned device ${dev.name} to campaign ${campaignId || 'None'}`);
    res.json({ success: true });
});

appAdmin.post('/api/devices/:id/play-now', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { assetId } = req.body;
    const dev = await dbGet("SELECT * FROM devices WHERE id = ?", [id]);

    if (!dev) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && dev.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: Not your device" });
    }

    const ws = clients.get(id);
    if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({ type: 'PLAY_NOW', assetId });
        ws.send(payload);
    }

    logAudit(req.user, 'PLAY_NOW', `Triggered instant playback of asset ${assetId} on device ${dev.name}`);
    res.json({ success: true });
});

// 8. Playlists
appAdmin.get('/api/playlists', requireAuth, async (req, res) => {
    let playlists;
    if (req.user.role === 'ADMIN') {
        playlists = await dbAll("SELECT * FROM playlists");
    } else {
        playlists = await dbAll("SELECT * FROM playlists WHERE ownerId = ?", [req.user.id]);
    }
    res.json(playlists.map(p => ({ ...p, assets: JSON.parse(p.assets || '[]') })));
});

appAdmin.post('/api/playlists', requireAuth, async (req, res) => {
    const { name, assets } = req.body;
    const id = Date.now().toString();
    const sanitizedAssets = sanitizeAssetList(assets || []);
    await dbRun("INSERT INTO playlists (id, name, assets, ownerId) VALUES (?, ?, ?, ?)", [id, name, JSON.stringify(sanitizedAssets), req.user.id]);
    logAudit(req.user, 'CREATE_PLAYLIST', `Created playlist ${name}`);
    const newPlaylist = await dbGet("SELECT * FROM playlists WHERE id = ?", [id]);
    res.json({ ...newPlaylist, assets: sanitizedAssets });
});

appAdmin.put('/api/playlists/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, assets } = req.body;
    const playlist = await dbGet("SELECT * FROM playlists WHERE id = ?", [id]);
    if (!playlist) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && playlist.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const sanitizedAssets = assets ? sanitizeAssetList(assets) : null;
    await dbRun("UPDATE playlists SET name = ?, assets = ? WHERE id = ?", 
        [name || playlist.name, sanitizedAssets ? JSON.stringify(sanitizedAssets) : playlist.assets, id]);
    
    logAudit(req.user, 'UPDATE_PLAYLIST_SAVED', `Updated saved playlist ${name || playlist.name}`);
    res.json({ success: true });
});

appAdmin.delete('/api/playlists/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const playlist = await dbGet("SELECT * FROM playlists WHERE id = ?", [id]);
    if (!playlist) return res.status(404).json({ error: "Not found" });

    if (req.user.role !== 'ADMIN' && playlist.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await dbRun("DELETE FROM playlists WHERE id = ?", [id]);
    logAudit(req.user, 'DELETE_PLAYLIST_SAVED', `Deleted saved playlist ${playlist.name}`);
    res.json({ success: true });
});

// 11. Utils & Proxy
appAdmin.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL required');

    try {
        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        const body = await response.text();

        // Pass through content type
        res.set('Content-Type', contentType || 'text/html');
        res.set('Access-Control-Allow-Origin', '*');
        
        // Remove ALL headers that prevent iframing (including variants)
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('Content-Security-Policy-Report-Only');
        res.removeHeader('X-Content-Security-Policy');
        res.removeHeader('X-WebKit-CSP');
        
        // Inject base tag so relative links/assets still work
        let modifiedBody = body;
        if (contentType && contentType.includes('text/html')) {
            const baseTag = `<base href="${url}">`;
            // Try to find head, if not just prepend
            if (modifiedBody.toLowerCase().includes('<head>')) {
                modifiedBody = modifiedBody.replace(/<head>/i, `<head>${baseTag}`);
            } else {
                modifiedBody = baseTag + modifiedBody;
            }
        }
        
        res.send(modifiedBody);
    } catch (e) {
        res.status(500).send('Error proxying URL: ' + e.message);
    }
});

// 12. Maintenance & Cleanup
async function cleanupOrphanedUploads() {
    try {
        if (!fs.existsSync(UPLOADS_DIR)) return { deletedCount: 0, freedBytes: 0 };
        const files = fs.readdirSync(UPLOADS_DIR);
        if (!files.length) return { deletedCount: 0, freedBytes: 0 };

        const referenced = new Set();
        const collectUrls = (text) => {
            if (!text) return;
            const matches = text.match(/\/uploads\/([a-zA-Z0-9_\-\.]+)/g);
            if (matches) {
                matches.forEach(m => referenced.add(path.basename(m)));
            }
        };

        const devices = await dbAll("SELECT playlist FROM devices");
        devices.forEach(d => collectUrls(d.playlist));

        const groups = await dbAll("SELECT playlist, overlay FROM groups");
        groups.forEach(g => { collectUrls(g.playlist); collectUrls(g.overlay); });

        const playlists = await dbAll("SELECT assets FROM playlists");
        playlists.forEach(p => collectUrls(p.assets));

        const campaigns = await dbAll("SELECT zonePlaylists FROM campaigns");
        campaigns.forEach(c => collectUrls(c.zonePlaylists));

        let deletedCount = 0;
        let freedBytes = 0;
        files.forEach(f => {
            if (!referenced.has(f) && !f.startsWith('raw_') && !f.startsWith('tmp_')) {
                const p = path.join(UPLOADS_DIR, f);
                try {
                    const stat = fs.statSync(p);
                    // Only delete unreferenced files older than 1 hour to protect in-flight uploads
                    if (Date.now() - stat.mtimeMs > 3600000) {
                        freedBytes += stat.size;
                        fs.unlinkSync(p);
                        deletedCount++;
                    }
                } catch(e) {}
            }
        });
        if (deletedCount > 0) {
            console.log(`[MAINTENANCE] Pruned ${deletedCount} orphaned uploads, freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB.`);
        }
        return { deletedCount, freedBytes };
    } catch(e) {
        console.error("[MAINTENANCE] Cleanup error:", e);
        return { error: e.message };
    }
}

// Run cleanup on startup after 10 seconds and then every 24 hours
setTimeout(cleanupOrphanedUploads, 10000);
setInterval(cleanupOrphanedUploads, 24 * 3600 * 1000);

appAdmin.post('/api/system/cleanup', requireAuth, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Forbidden" });
    const result = await cleanupOrphanedUploads();
    logAudit(req.user, 'SYSTEM_CLEANUP', `Cleaned up ${result.deletedCount || 0} orphaned files (${((result.freedBytes || 0) / (1024 * 1024)).toFixed(2)} MB freed)`);
    res.json({ success: true, ...result });
});

appAdmin.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});

appAdmin.listen(ADMIN_PORT, '0.0.0.0', () => {
    console.log(`[Admin API] Running on port ${ADMIN_PORT}`);
});