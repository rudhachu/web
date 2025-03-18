const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./id');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function megaPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./temp`);
        try {
            let session = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
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
                        const sessionD = fs.readFileSync('./temp/creds.json');

                        const auth_path = './temp/';
                        const user_jid = jidNormalizedUser(session.user.id);

                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${user_jid}.json`);

                        const string_session = mega_url.replace('https://mega.nz/file/', '');

                        const sid = string_session;

                        const dt = await session.sendMessage(user_jid, {
                            text: sid
                        });

                    } catch (e) {
                        exec('pm2 restart rudhra');
                    }

                    await delay(100);
                    return await removeFile('./temp');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    megaPair();
                }
            });
        } catch (err) {
            exec('pm2 restart rudhra');
            console.log("service restarted");
            megaPair();
            await removeFile('./temp');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }
    return await megaPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart rudhra');
});

module.exports = router;