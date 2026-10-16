const crypto = require('crypto');


const hash = (code)=> {
    return crypto.createHash('sha256').update(String(code)).digest('hex');

};

const clean = (e) => {
    return String(e || '').trim().toLowerCase();
};
const isEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
const fail = (status, message) => {
    return Object.assign(new Error(message), { status });
};

module.exports = { hash, clean, isEmail, fail };