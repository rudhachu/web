const fs = require('fs');
const path = require('path');
const mega = require("megajs");

const auth = {
    email: 'princerudh.in@gmail.com', 
    password: 'rudhra2025', 
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            if (!auth.email || !auth.password || !auth.userAgent) {
                throw new Error("Missing required authentication fields");
            }

            console.log("Using auth:", auth); 

            const storage = new mega.Storage(auth, () => {
                data.pipe(storage.upload({ name: name, allowUploadBuffering: true }));
                storage.on("add", (file) => {
                    file.link((err, url) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        storage.close();
                        resolve(url);
                    });
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

const RandomNames = [
    'Rudhra~rUd0hRaArH3dur',
    'Rudhra~RuD0rAaRh3DuR',
    'Rudhra~ArH0durRUd3rA',
    'Rudhra~aRh0DuRrUd3hRa'
];

/**
 * Uploads content to Pastebin, handling different input types like text, files, and base64 data.
 * @param {string | Buffer} input - The content to upload, can be text, file path, or base64 data.
 * @param {string} [title] - Optional title for the paste.
 * @param {string} [format] - Optional syntax highlighting format (e.g., 'text', 'python', 'javascript').
 * @param {string} [privacy] - Optional privacy setting (0 = public, 1 = unlisted, 2 = private).
 * @returns {Promise<string>} - The custom URL of the created paste.
 */
async function uploadToPastebin(input, title = 'Untitled', format = 'json', privacy = '1') {
    try {
        const { PasteClient, Publicity } = await import('pastebin-api');
        const client = new PasteClient("Q80IAWeVRBgHkz5GVKCnwZmc0iudKVgk");

        const publicityMap = {
            '0': Publicity.Public,
            '1': Publicity.Unlisted,
            '2': Publicity.Private,
        };

        let contentToUpload = '';

        if (Buffer.isBuffer(input)) {
            contentToUpload = input.toString();
        } else if (typeof input === 'string') {
            if (input.startsWith('data:')) {
                const base64Data = input.split(',')[1];
                contentToUpload = Buffer.from(base64Data, 'base64').toString();
            } else if (input.startsWith('http://') || input.startsWith('https://')) {

                contentToUpload = input;
            } else if (fs.existsSync(input)) {
                contentToUpload = fs.readFileSync(input, 'utf8');
            } else {
                contentToUpload = input;
            }
        } else {
            throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
        }

        const pasteUrl = await client.createPaste({
            code: contentToUpload,
            expireDate: 'N', 
            format: format, 
            name: title,
            publicity: publicityMap[privacy], 
        });

        console.log('Original Pastebin URL:', pasteUrl);

        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = `${RandomNames[Math.floor(Math.random() * RandomNames.length)]}${pasteId}`;

        console.log('Custom URL:', customUrl);

        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = { uploadToPastebin, upload };
