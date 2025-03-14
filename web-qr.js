const uploadToPastebin = require('./main');  
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

const router = express.Router();

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
// Helper Function: Remove a file or directory if it exists
function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    const tempPath = `./temp/`;

    async function Getqr() {
        const { state, saveCreds } = await useMultiFileAuthState(tempPath);

        try {
            const session = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: getRandomBrowser(), // Assign a random browser
             });

            session.ev.on('creds.update', saveCreds);
            session.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                const colors = ['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#800080'];  // Array of colors
const randomColor = colors[Math.floor(Math.random() * colors.length)];  // Pick a random color

if (qr) {
  const buffer = await QRCode.toBuffer(qr, {
    type: 'png',              // Output type (PNG)
    color: {
      dark: randomColor,      // Random dark color
      light: '#00000000'      // Transparent background
    },
    width: 300,               // Adjust the size if needed
  });

  await res.end(buffer);
}

                if (connection === "open") {
                    // Connection established
                    await delay(5000);
                    const credsPath = `${tempPath}/creds.json`;

                    if (!fs.existsSync(credsPath)) {
                        throw new Error("Credentials file not found");
                    }

                    const pastebinUrl = await uploadToPastebin(fs.createReadStream(credsPath), `${session.user.id}.json`);
                    const Scan_Id = pastebinUrl;

                    const textMsg = `\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`;

                    // Send session code and info message to the connected user
                    const message = await session.sendMessage(session.user.id, { text: sessionCode });
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
                            showAdAttribution: true
                                },
                            },
                        },
                        { quoted: message }
                    );

                    // Clean up and close connection
                    await delay(10);
                    session.ws.close();
                    removeFile(tempPath);
                    console.log(`${session.user.id} Connected Restarting process...`);
                    process.exit();
                }

                if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    // Restart on unexpected disconnection
                    await delay(10);
                    Getqr();
                }
            });
        } catch (error) {
            console.error("Service encountered an error:", error);
            removeFile(tempPath);
            if (!res.headersSent) {
                res.status(503).send({ code: "Service Unavailable" });
            }
        }
    }

    await Getqr();
});

// Automatic Restart Every 30 Minutes
setInterval(() => {
    console.log("Restarting process...");
    process.exit();
}, 1800000); // 30 minutes

module.exports = router;