const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data/database.sqlite');
const UPLOADS_DIR = path.join(__dirname, 'data/uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function decodeBase64Asset(content, originalName) {
    if (!content || !content.startsWith('data:')) {
        return null;
    }
    const matches = content.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        return null;
    }
    const mime = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    let ext = 'bin';
    if (mime.includes('/')) {
        ext = mime.split('/')[1];
    }
    ext = ext.split(';')[0].trim();
    
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`[MIGRATE] Saved Base64 asset as: ${filename} (${buffer.length} bytes)`);
    return `/uploads/${filename}`;
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
    runMigration();
});

function dbAll(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function runMigration() {
    try {
        console.log('Starting migration for devices...');
        const devices = await dbAll('SELECT id, name, playlist, overlay FROM devices');
        for (const dev of devices) {
            let playlistUpdated = false;
            let overlayUpdated = false;
            let playlist = [];
            
            if (dev.playlist) {
                try {
                    playlist = JSON.parse(dev.playlist);
                } catch (e) {
                    console.error(`Failed to parse playlist for device ${dev.id}:`, e);
                    continue;
                }
            }
            
            // Migrate playlist assets
            if (Array.isArray(playlist)) {
                for (const asset of playlist) {
                    if (asset.url && asset.url.startsWith('data:')) {
                        const newUrl = decodeBase64Asset(asset.url, asset.name);
                        if (newUrl) {
                            asset.url = newUrl;
                            playlistUpdated = true;
                        }
                    }
                }
            }
            
            // Migrate overlay
            let newOverlay = dev.overlay;
            if (dev.overlay && dev.overlay.startsWith('data:')) {
                const newUrl = decodeBase64Asset(dev.overlay, 'overlay');
                if (newUrl) {
                    newOverlay = newUrl;
                    overlayUpdated = true;
                }
            }
            
            if (playlistUpdated || overlayUpdated) {
                console.log(`Updating device ${dev.name || dev.id}...`);
                await dbRun(
                    'UPDATE devices SET playlist = ?, overlay = ? WHERE id = ?',
                    [JSON.stringify(playlist), newOverlay, dev.id]
                );
            }
        }

        console.log('Starting migration for groups...');
        const groups = await dbAll('SELECT id, name, playlist, overlay FROM groups');
        for (const grp of groups) {
            let playlistUpdated = false;
            let overlayUpdated = false;
            let playlist = [];
            
            if (grp.playlist) {
                try {
                    playlist = JSON.parse(grp.playlist);
                } catch (e) {
                    console.error(`Failed to parse playlist for group ${grp.id}:`, e);
                    continue;
                }
            }
            
            // Migrate playlist assets
            if (Array.isArray(playlist)) {
                for (const asset of playlist) {
                    if (asset.url && asset.url.startsWith('data:')) {
                        const newUrl = decodeBase64Asset(asset.url, asset.name);
                        if (newUrl) {
                            asset.url = newUrl;
                            playlistUpdated = true;
                        }
                    }
                }
            }
            
            // Migrate overlay
            let newOverlay = grp.overlay;
            if (grp.overlay && grp.overlay.startsWith('data:')) {
                const newUrl = decodeBase64Asset(grp.overlay, 'overlay');
                if (newUrl) {
                    newOverlay = newUrl;
                    overlayUpdated = true;
                }
            }
            
            if (playlistUpdated || overlayUpdated) {
                console.log(`Updating group ${grp.name || grp.id}...`);
                await dbRun(
                    'UPDATE groups SET playlist = ?, overlay = ? WHERE id = ?',
                    [JSON.stringify(playlist), newOverlay, grp.id]
                );
            }
        }

        console.log('Starting migration for campaigns...');
        const campaigns = await dbAll('SELECT id, name, zonePlaylists FROM campaigns');
        for (const camp of campaigns) {
            let updated = false;
            let zonePlaylists = {};
            if (camp.zonePlaylists) {
                try {
                    zonePlaylists = JSON.parse(camp.zonePlaylists);
                } catch (e) {
                    console.error(`Failed to parse zonePlaylists for campaign ${camp.id}:`, e);
                    continue;
                }
            }
            if (typeof zonePlaylists === 'object' && zonePlaylists !== null) {
                for (const zoneKey of Object.keys(zonePlaylists)) {
                    const zoneList = zonePlaylists[zoneKey];
                    if (Array.isArray(zoneList)) {
                        for (const asset of zoneList) {
                            if (asset.url && asset.url.startsWith('data:')) {
                                const newUrl = decodeBase64Asset(asset.url, asset.name || 'campaign-asset');
                                if (newUrl) {
                                    asset.url = newUrl;
                                    updated = true;
                                }
                            }
                        }
                    }
                }
            }
            if (updated) {
                console.log(`Updating campaign ${camp.name || camp.id}...`);
                await dbRun(
                    'UPDATE campaigns SET zonePlaylists = ? WHERE id = ?',
                    [JSON.stringify(zonePlaylists), camp.id]
                );
            }
        }

        console.log('Starting migration for saved playlists...');
        const playlists = await dbAll('SELECT id, name, assets FROM playlists');
        for (const pl of playlists) {
            let updated = false;
            let assets = [];
            if (pl.assets) {
                try { assets = JSON.parse(pl.assets); } catch (e) {}
            }
            if (Array.isArray(assets)) {
                for (const asset of assets) {
                    if (asset.url && asset.url.startsWith('data:')) {
                        const newUrl = decodeBase64Asset(asset.url, asset.name || 'playlist-asset');
                        if (newUrl) {
                            asset.url = newUrl;
                            updated = true;
                        }
                    }
                }
            }
            if (updated) {
                console.log(`Updating saved playlist ${pl.name || pl.id}...`);
                await dbRun(
                    'UPDATE playlists SET assets = ? WHERE id = ?',
                    [JSON.stringify(assets), pl.id]
                );
            }
        }
        
        console.log('Running VACUUM to reclaim disk space...');
        await dbRun('VACUUM');
        console.log('Migration completed successfully.');
        
        // Show new database size
        const stats = fs.statSync(DB_PATH);
        console.log(`New database file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        db.close(() => {
            console.log('Database connection closed.');
        });
    }
}
