const express = require('express');
const fs = require('fs-extra');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const uploadToPastebin = require('./main');  
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

// List of available browser configurations
const browserOptions = [
        Browsers.macOS("Safari"),
        Browsers.macOS("Desktop"),
        Browsers.macOS("Firefox"),
        Browsers.macOS("Opera"),
];

// Function to pick a random browser
function getRandomBrowser() {
        return browserOptions[Math.floor(Math.random() * browserOptions.length)];
}

if (fs.existsSync('./temp')) {
    fs.emptyDirSync(__dirname + '/temp');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function getPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./temp`);
        try {
            const session = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: getRandomBrowser(), // Assign a random browser
             });

            if (!session.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await session.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            session.ev.on('creds.update', saveCreds);
            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(10000);
                        if (fs.existsSync('./temp/creds.json'));

                        const auth_path = './temp/';
                        let user = session.user.id;

                        // Upload the creds.json to Pastebin directly
                        const credsFilePath = auth_path + 'creds.json';
                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');

                        const Scan_Id = pastebinUrl;  // Use the Pastebin URL as the session ID
                        const pairMsg = `\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`;
                        const sessionMsg = await session.sendMessage(user, { text: Scan_Id });
                        await session.sendMessage(user, { text: pairMsg }, { quoted: sessionMsg });
                        await delay(1000);
                        try { await fs.emptyDirSync(__dirname + '/temp'); } catch (e) {}

                    } catch (e) {
                        console.log("Error during file upload or message send: ", e);
                    }

                    await delay(100);
                    await fs.emptyDirSync(__dirname + '/temp');
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed!");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server!");
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        getPair().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut!");
                    } else {
                        console.log('Connection closed with bot. Please run again.');
                        console.log(reason);
                        await delay(5000);
                        exec('pm2 restart rudhra');
                    }
                }
            });

        } catch (err) {
            console.log("Error in getPair function: ", err);
            exec('pm2 restart rudhra');
            console.log("Service restarted due to error");
            getPair();
            await fs.emptyDirSync(__dirname + '/temp');
            if (!res.headersSent) {
                await res.send({ code: "Try After Few Minutes" });
            }
        }
    }

   return await getPair();
});

module.exports = router;
