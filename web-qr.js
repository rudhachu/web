const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const uploadToPastebin = require('./main');  

const router = express.Router();
const TEMP_PATH = `./temp/`;

// **Browser Options**
const browserOptions = [
    Browsers.macOS("Desktop"),
    Browsers.macOS("Safari"),
    Browsers.macOS("Firefox"),
    Browsers.macOS("Opera"),
];

// **Helper Functions**
function getRandomBrowser() {
    return browserOptions[Math.floor(Math.random() * browserOptions.length)];
}

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

// **Main Function: Generate WhatsApp QR Code**
async function GetQR(req, res) {
    const { state, saveCreds } = await useMultiFileAuthState(TEMP_PATH);

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

            if (qr) return res.end(await QRCode.toBuffer(qr));

            if (connection === "open") {
                await handleSuccessfulConnection(session);
            }

            if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                await delay(10);
                GetQR(req, res);
            }
        });
    } catch (error) {
        console.error("Service encountered an error:", error);
        removeFile(TEMP_PATH);
        if (!res.headersSent) {
            res.status(503).send({ code: "Service Unavailable" });
        }
    }
}

// **Handle Successful WhatsApp Connection**
async function handleSuccessfulConnection(session) {
    await delay(5000);
    const credsPath = `${TEMP_PATH}/creds.json`;

    if (!fs.existsSync(credsPath)) {
        throw new Error("Credentials file not found");
    }

    const pastebinUrl = await uploadToPastebin(fs.createReadStream(credsPath), `${session.user.id}.json`);
    const scanId = pastebinUrl;

    const infoMessage = `\n*ᴅᴇᴀʀ ᴜsᴇʀ, ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`;

    const message = await session.sendMessage(session.user.id, { text: scanId });
    await session.sendMessage(
        session.user.id,
        {
            text: infoMessage,
            contextInfo: {
                externalAdReply: {
                    title: "𝗥𝗨𝗗𝗛𝗥𝗔 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗜𝗗",
                    body: "ʀᴜᴅʜʀᴀ ʙᴏᴛ",
                    thumbnailUrl: "https://i.imgur.com/Zim2VKH.jpeg",
                    sourceUrl: "https://github.com/princerudh/rudhra-bot",
                    mediaUrl: "https://github.com",
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    showAdAttribution: true
                },
            },
        },
        { quoted: message }
    );

    // Cleanup and Restart
    await delay(10);
    session.ws.close();
    removeFile(TEMP_PATH);
    console.log(`${session.user.id} Connected. Restarting process...`);
    process.exit();
}

// **Route to Generate QR Code**
router.get('/', async (req, res) => {
    await GetQR(req, res);
});

// **Automatic Restart Every 30 Minutes**
setInterval(() => {
    console.log("Restarting process...");
    process.exit();
}, 1800000); // 30 minutes

module.exports = router;