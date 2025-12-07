// Helper functions

function randomId() {
    return Math.random().toString(36).slice(2);
}

function generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = require('crypto').randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

function base64URLStringToBuffer(base64URLString) {
    const base64 = base64URLString
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');

    return Buffer.from(paddedBase64, 'base64');
}

function bufferToBase64URLString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

module.exports = {
    randomId,
    generateShortId,
    base64URLStringToBuffer,
    bufferToBase64URLString,
};

