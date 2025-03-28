const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require("pino");
const QRCode = require('qrcode');
const sharp = require('sharp');
const PastebinAPI = require('pastebin-js');
const { makeid } = require('./id');
const { readFile } = require("node:fs/promises");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
} = require("@whiskeysockets/baileys");

// Initialize router & Pastebin API
const router = express.Router();
const pastebin = new PastebinAPI('Q80IAWeVRBgHkz5GVKCnwZmc0iudKVgk');

// Define browser options for WhatsApp Web
const browserOptions = [
    Browsers.macOS("Safari"),
    Browsers.macOS("Desktop"),
    Browsers.macOS("Firefox"),
    Browsers.macOS("Opera"),
];

// Function to select a random browser
function getRandomBrowser() {
    return browserOptions[Math.floor(Math.random() * browserOptions.length)];
}

// Function to remove session files
function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

// List of specific JSON files to read from session
const specificFiles = [
    'creds.json',
    'app-state-sync-key-AAAAAED1.json',
    'pre-key-1.json',
    'pre-key-2.json',
    'pre-key-3.json',
    'pre-key-5.json',
    'pre-key-6.json'
];

// Function to read specific JSON session files
function readSpecificJSONFiles(folderPath) {
    const result = {};
    specificFiles.forEach(file => {
        const filePath = path.join(folderPath, file);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            result[file] = JSON.parse(fileContent);
        } else {
            console.warn(`File not found: ${filePath}`);
        }
    });
    return result;
}

// Route to generate a QR code for WhatsApp Web authentication
router.get('/', async (req, res) => {
    const id = makeid(); // Generate a unique session ID

    async function GetQR() {
        const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);

        try {
            let session = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: getRandomBrowser(), // Assign a random browser
            });

            session.ev.on('creds.update', saveCreds);

            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr) {
                    // Generate a QR code with a random dark color
                    const colors = ['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#800080'];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];

                    const qrBuffer = await QRCode.toBuffer(qr, {
                        type: 'png',
                        color: {
                            dark: randomColor,  // Random dark color
                            light: '#00000000'  // Transparent background
                        },
                        width: 300
                    });

                    const qrImage = sharp(qrBuffer);
                    const pngImage = sharp(path.resolve(__dirname, 'media/princerudh.png'));

                    const qrMetadata = await qrImage.metadata();
                    const size = Math.min(qrMetadata.width, qrMetadata.height) / 2;
                    const pngResized = pngImage.resize(size, size);

                    const qrWithOverlay = await qrImage
                        .composite([{ input: await pngResized.toBuffer(), gravity: 'centre' }])
                        .toBuffer();

                    res.setHeader('Content-Type', 'image/png');
                    res.end(qrWithOverlay);
                }

                if (connection === "open") {
                    await delay(10000);

                    // Merge and upload session data
                    const mergedJSON = await readSpecificJSONFiles(path.resolve(__dirname, `temp/${id}`));
                    const sessionFilePath = path.resolve(__dirname, `temp/${id}/${id}.json`);
                    fs.writeFileSync(sessionFilePath, JSON.stringify(mergedJSON));

                    // Upload session data to Pastebin
                    const pasteURL = await pastebin.createPasteFromFile(sessionFilePath, "Session Data", null, 1, "N");
                    const message = pasteURL.split('/')[3];
                    const encodedMessage = `Rudhra~${message.split('').reverse().join('')}`;

                    // Send the encoded Pastebin link via WhatsApp
                    await session.sendMessage(session.user.id, { text: encodedMessage });
                    await delay(100);

                    // Close session and clean up files
                    await session.ws.close();
                    removeFile(`temp/${id}`);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    GetQR();
                }
            });
        } catch (err) {
            if (!res.headersSent) {
                res.json({ code: "Service Unavailable" });
            }
            console.error("Error in QR Generation:", err);
            removeFile(`temp/${id}`);
        }
    }

    return await GetQR();
});

module.exports = router;
