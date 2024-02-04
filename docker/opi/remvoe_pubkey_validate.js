const fs = require('fs');
const path = require('path')
const TARGET_FILE = path.resolve(__dirname, 'node_modules/bitcoinjs-lib/src/payments/p2tr.js');
const BACKUP_FILE = `${TARGET_FILE}.backup`;

// Exact content to be removed
const contentToRemove = `
    if (pubkey && pubkey.length) {
      if (!(0, ecc_lib_1.getEccLib)().isXOnlyPoint(pubkey))
        throw new TypeError('Invalid pubkey for p2tr');
    }
`.trim(); // trim() to remove the extra newlines

fs.readFile(TARGET_FILE, 'utf8', (err, data) => {
    if (err) {
        return console.error(`Error reading ${TARGET_FILE}: ${err.message}`);
    }

    // Check if the content is present
    if (!data.includes(contentToRemove)) {
        return console.log('The specified content is not present in the file.');
    }

    // Create a backup if it doesn't exist
    if (!fs.existsSync(BACKUP_FILE)) {
        fs.writeFileSync(BACKUP_FILE, data);
        console.log(`Backup created at ${BACKUP_FILE}`);
    }

    // Remove the specified content
    const updatedData = data.replace(contentToRemove, '');

    fs.writeFile(TARGET_FILE, updatedData, 'utf8', (writeErr) => {
        if (writeErr) {
            return console.error(`Error writing to ${TARGET_FILE}: ${writeErr.message}`);
        }
        console.log(`The specified content has been removed from ${TARGET_FILE}.`);
    });
});