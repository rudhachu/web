const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs-extra');  // Use fs-extra for better file operations
const pino = require("pino");
const path = require("path");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
} = require("@whiskeysockets/baileys");
const uploadToPastebin = require('./main');

const router = express.Router();
const tempDir = path.join(__dirname, 'temp');

// Ensure temp directory is empty at startup
fs.ensureDirSync(tempDir);
fs.emptyDirSync(tempDir);

// List of available browser configurations
const browserOptions = [
    Browsers.macOS("Desktop"),
    Browsers.macOS("Safari"),
    Browsers.macOS("Firefox"),
    Browsers.macOS("Opera"),
];

// Function to pick a random browser
function getRandomBrowser() {
    return browserOptions[Math.floor(Math.random() * browserOptions.length)];
}

// Function to clean up temp directory
async function cleanUpTempDir() {
    try {
        await fs.emptyDir(tempDir);
    } catch (err) {
        console.error('Error clearing temp directory:', err);
    }
}

// Function to generate WhatsApp Web QR
async function GetQR(req, res) {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    try {
        const session = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: getRandomBrowser(),
        });

        session.ev.on('creds.update', saveCreds);
        session.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                const colors = ['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#800080'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];

                const buffer = await QRCode.toBuffer(qr, {
                    type: 'png',
                    color: { dark: randomColor, light: '#00000000' }, // Transparent background
                    width: 300,
                });

                return res.end(buffer);
            }

            if (connection === "open") {
                await delay(5000);
                const credsPath = path.join(tempDir, 'creds.json');

                if (!fs.existsSync(credsPath)) {
                    throw new Error("Credentials file not found");
                }

                // Upload credentials to Pastebin
                const pastebinUrl = await uploadToPastebin(credsPath, 'creds.json', 'json', '1');

                const textMsg = `\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`;

                // Send session ID to user
                const message = await session.sendMessage(session.user.id, { text: pastebinUrl });
                await session.sendMessage(
                    session.user.id,
                    {
                        text: textMsg,
                        contextInfo: {
                            externalAdReply: {
                                title: "𝗥𝗨𝗗𝗛𝗥𝗔 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗜𝗗",
                                body: "ʀᴜᴅʜʀᴀ ʙᴏᴛ",
                                thumbnailUrl: "https://i.imgur.com/Zim2VKH.jpeg",
                                sourceUrl: "https://github.com/princerudh/rudhra-bot",
                                mediaUrl: "https://github.com",
                                mediaType: 1,
                                renderLargerThumbnail: false,
                                showAdAttribution: true,
                            },
                        },
                    },
                    { quoted: message }
                );

                // Clean up and close connection
                await delay(10);
                session.ws.close();
                await cleanUpTempDir();
                console.log(`${session.user.id} Connected. Restarting process...`);
            }

            if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                console.log("Connection lost. Retrying...");
                await delay(10);
                GetQR(req, res);
            }
        });
    } catch (error) {
        console.error("Service encountered an error:", error);
        await cleanUpTempDir();
        if (!res.headersSent) {
            res.status(503).json({ code: "Service Unavailable" });
        }
    }
}

// Route to serve QR code
router.get('/', async (req, res) => {
    await GetQR(req, res);
});

// Automatic Restart Every 30 Minutes
setInterval(() => {
    console.log("Restarting process...");
    process.exit();
}, 1800000); // 30 minutes

module.exports = router;