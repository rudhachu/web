const { exec } = require("child_process");
const uploadToPastebin = require('./main');  
const express = require('express');
let router = express.Router();
const pino = require("pino");

const { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");

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

if (fs.existsSync('./temp')) {
  fs.emptyDirSync(__dirname + '/temp');
}

router.get('/', async (req, res) => {
  const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason, makeInMemoryStore } = require("@whiskeysockets/baileys");
  const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

  async function Getqr() {
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/temp');

    try {
      const session = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: getRandomBrowser(), // Assign a random browser
             });

      session.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

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
          await delay(3000);
          let user = session.user.id;

          //===========================================================================================
          //===============================  SESSION ID    ===========================================
          //===========================================================================================

          const auth_path = './temp/';
          const credsFilePath = auth_path + 'creds.json';

          // Upload the creds.json file to Pastebin directly
          const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
          
          const Scan_Id = pastebinUrl;  // Use the returned Pastebin URL directly

          console.log(`
====================  SESSION ID  ==========================
SESSION-ID ==> ${Scan_Id}
-------------------   SESSION CLOSED   -----------------------
`);
          const qrMsg = `\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`;
          const sessionMsg = await session.sendMessage(user, { text: Scan_Id });
          await session.sendMessage(user, { text: qrMsg }, { quoted: sessionMsg });
          await delay(1000);

          try {
            await fs.emptyDirSync(__dirname + '/temp');
          } catch (e) {
            console.error('Error clearing directory:', e);
          }
        }

        session.ev.on('creds.update', saveCreds);

        if (connection === "close") {
          let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
          // Handle disconnection reasons
          if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed!");
          } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection Lost from Server!");
          } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart Required, Restarting...");
            Getqr().catch(err => console.log(err));
          } else if (reason === DisconnectReason.timedOut) {
            console.log("Connection TimedOut!");
          } else {
            console.log('Connection closed with bot. Please run again.');
            console.log(reason);
            await delay(5000);
            exec('pm2 restart rudhra');
            process.exit(0);
          }
        }
      });

    } catch (err) {
      console.log(err);
      exec('pm2 restart rudhra');
      await fs.emptyDirSync(__dirname + '/temp');
    }
  }

  Getqr().catch(async (err) => {
    console.log(err);
    await fs.emptyDirSync(__dirname + '/temp');
    exec('pm2 restart rudhra');
  });

  return await Getqr();
});

module.exports = router;
