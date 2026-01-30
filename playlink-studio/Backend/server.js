// server.js - Passerelle HTTP vers AMCP (CasparCG) + FTP
// Version: 2.5 (Ajout FTP Sync)

const express = require('express');
const net = require('net');
const cors = require('cors');
const ftp = require("basic-ftp"); // Nécessite: npm install basic-ftp

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const CASPAR_HOST = '127.0.0.1'; 
const CASPAR_PORT = 5250;      
const API_PORT = 3000;         

// --- CONFIGURATION FTP ---
const FTP_CONFIG = {
    host: "192.168.1.100", // À modifier
    user: "user",          // À modifier
    password: "password",  // À modifier
    secure: false,         // true pour FTPS
    targetDir: "/"         // Dossier à scanner (ex: "/INGEST/TODAY")
};

// --- CLIENT TCP CASPARCG ---
let client = new net.Socket();
let isConnected = false;

const connectToCaspar = () => {
    console.log(`🔌 Connexion à CasparCG (${CASPAR_HOST}:${CASPAR_PORT})...`);
    client.connect(CASPAR_PORT, CASPAR_HOST, () => {
        console.log(`✅ Connecté à CasparCG Server`);
        isConnected = true;
    });

    client.on('error', (err) => {
        console.error("⚠️ Erreur CasparCG:", err.message);
        isConnected = false;
    });

    client.on('close', () => {
        console.log('❌ Déconnecté. Tentative de reconnexion dans 5s...');
        isConnected = false;
        setTimeout(connectToCaspar, 5000);
    });
};

connectToCaspar();

const queryListCommand = (command) => {
    return new Promise((resolve, reject) => {
        if (!isConnected) return reject("CasparCG Offline");
        let buffer = '';
        const onData = (data) => {
            buffer += data.toString();
            if (buffer.endsWith('\r\n\r\n')) {
                client.removeListener('data', onData);
                resolve(buffer);
            } else if ((buffer.startsWith('4') || buffer.startsWith('5')) && buffer.endsWith('\r\n')) {
                client.removeListener('data', onData);
                resolve(buffer); 
            }
        };
        client.on('data', onData);
        client.write(command + '\r\n');
        setTimeout(() => {
            client.removeListener('data', onData);
            if (buffer.length > 0) resolve(buffer);
            else reject("Timeout AMCP");
        }, 2000);
    });
};

// --- ROUTES API ---

app.get('/health', (req, res) => {
    res.json({ online: true, casparConnection: isConnected });
});

// 1. ROUTE MÉDIAS (CLS)
app.get('/caspar/files', async (req, res) => {
    if (!isConnected) return res.json([]);
    try {
        const raw = await queryListCommand('CLS');
        const lines = raw.split(/\r?\n/);
        const files = lines
            .filter(line => line.includes('"'))
            .map(line => {
                const match = line.match(/"([^"]+)"\s+(\w+)\s+(\d+)\s+(\d+)/);
                if (!match) return null;
                return {
                    name: match[1], type: match[2], size: parseInt(match[3]), updated: match[4]
                };
            }).filter(Boolean);
        res.json(files);
    } catch (e) {
        console.error("Erreur CLS:", e);
        res.status(500).json([]);
    }
});

// 2. ROUTE TEMPLATES (TLS)
app.get('/caspar/templates', async (req, res) => {
    if (!isConnected) return res.json([]);
    try {
        const raw = await queryListCommand('TLS');
        const lines = raw.split(/\r?\n/);
        const templates = lines
            .filter(line => {
                const trimmed = line.trim();
                return trimmed.length > 0 && !trimmed.startsWith('200') && !trimmed.startsWith('4') && !trimmed.startsWith('5');
            })
            .map(line => {
                const nameMatch = line.match(/"([^"]+)"/);
                if (nameMatch) return { name: nameMatch[1], size: 0, updated: '' };
                if (line.trim().length > 0) return { name: line.trim(), size: 0, updated: '' };
                return null;
            }).filter(Boolean);
        res.json(templates);
    } catch (e) {
        console.error("Erreur TLS:", e);
        res.status(500).json([]);
    }
});

// 3. ROUTE FTP SYNC (NEW)
app.get('/ftp/sync', async (req, res) => {
    const clientFTP = new ftp.Client();
    // clientFTP.ftp.verbose = true; // Décommenter pour debug

    try {
        console.log("📡 Connexion FTP...");
        await clientFTP.access({
            host: FTP_CONFIG.host,
            user: FTP_CONFIG.user,
            password: FTP_CONFIG.password,
            secure: FTP_CONFIG.secure
        });

        console.log(`📂 Listing du dossier: ${FTP_CONFIG.targetDir}`);
        const list = await clientFTP.list(FTP_CONFIG.targetDir);
        
        // Filtrer pour la date d'aujourd'hui
        const today = new Date();
        const todayStr = today.toDateString(); // ex: "Wed Jan 28 2026"

        const recentFiles = list.filter(file => {
            // Attention: certains serveurs FTP ne renvoient pas modifiedAt correctement
            if (!file.modifiedAt) return false;
            const fileDate = new Date(file.modifiedAt);
            return fileDate.toDateString() === todayStr && !file.isDirectory;
        }).map(f => ({
            name: f.name,
            size: f.size,
            date: f.modifiedAt,
            path: FTP_CONFIG.targetDir
        }));

        console.log(`✅ ${recentFiles.length} fichiers trouvés pour aujourd'hui.`);
        clientFTP.close();
        res.json({ success: true, files: recentFiles });

    } catch (err) {
        console.error("❌ Erreur FTP:", err);
        clientFTP.close();
        res.status(500).json({ success: false, error: err.message });
    }
});

// ... Routes standards (LOAD, PLAY, CLEAR, CG) ...
app.post('/caspar/load', (req, res) => {
    const { channel, layer, file, loop } = req.body;
    const loopCmd = loop ? " LOOP" : "";
    const cmd = `LOADBG ${channel}-${layer} "${file}" AUTO${loopCmd}`;
    if (isConnected) client.write(cmd + '\r\n');
    res.json({ success: true });
});

app.post('/caspar/play', (req, res) => {
    const { channel, layer } = req.body;
    if (isConnected) client.write(`PLAY ${channel}-${layer}\r\n`);
    res.json({ success: true });
});

app.post('/caspar/pause', (req, res) => {
    const { channel, layer } = req.body;
    if (isConnected) client.write(`PAUSE ${channel}-${layer}\r\n`);
    res.json({ success: true });
});

app.post('/caspar/clear', (req, res) => {
    const { channel, layer } = req.body;
    const cmd = layer ? `CLEAR ${channel}-${layer}` : `CLEAR ${channel}`;
    if (isConnected) client.write(cmd + '\r\n');
    res.json({ success: true });
});

app.post('/caspar/cg-add', (req, res) => {
    const { channel, layer, template, data } = req.body;
    let dataStr = data && Object.keys(data).length > 0 ? ` 1 "${JSON.stringify(data).replace(/"/g, '\\"')}"` : " 1";
    const cmd = `CG ${channel}-${layer} ADD 1 "${template}"${dataStr}`;
    if (isConnected) client.write(cmd + '\r\n');
    res.json({ success: true });
});

app.post('/caspar/cg-stop', (req, res) => {
    const { channel, layer } = req.body;
    const cmd = `CG ${channel}-${layer} STOP 1`;
    if (isConnected) client.write(cmd + '\r\n');
    res.json({ success: true });
});

app.listen(API_PORT, () => {
    console.log(`🚀 PlayLink Bridge actif sur le port ${API_PORT}`);
});