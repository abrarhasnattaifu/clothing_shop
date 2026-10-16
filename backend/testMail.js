require('dotenv').config();
const nodemailer = require('nodemailer');

const configs = {
    'Gmail port 465 (SSL)': { host: 'smtp.gmail.com', port: 465, secure: true },
    'Gmail port 587 (STARTTLS)': { host: 'smtp.gmail.com', port: 587, secure: false }
};

(async () => {
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'found' : 'MISSING');
    console.log('EMAIL_PASSWORD length:', (process.env.EMAIL_PASSWORD || '').length, '(should be 16)');

    for (const [name, cfg] of Object.entries(configs)) {
        const transporter = nodemailer.createTransport({
            ...cfg,
            family: 4,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
        });
        try {
            await transporter.verify();
            console.log('OK  ', name);
        } catch (err) {
            console.log('FAIL', name, '->', err.code || '', err.message);
        }
    }
})();