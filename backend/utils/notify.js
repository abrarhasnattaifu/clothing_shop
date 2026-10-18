const nodemailer = require('nodemailer');
const db = require('../db'); 

const transporter = nodemailer.createTransport({
    service: 'gmail',
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
});

const notifyAdmin = async (message, orderId = null) => {
    await db.query('INSERT INTO notifications (message, order_id) VALUES (?, ?)', [message, orderId]);

    if (process.env.ADMIN_EMAIL) {
        transporter
            .sendMail({
                from: '"Clothify" <' + process.env.EMAIL_USER + '>',
                to: process.env.ADMIN_EMAIL,
                subject: 'Clothify: ' + message,
                text: message
            })
            .catch((e) => console.error('Admin email failed:', e.message));
    }
};

module.exports = { notifyAdmin };