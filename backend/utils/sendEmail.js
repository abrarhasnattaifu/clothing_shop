const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
});

async function sendEmail({ to, subject, text }) {
    if (process.env.RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'MamaCloset <onboarding@resend.dev>',
                to,
                subject,
                text
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Email provider rejected the request.');
        }
        return result;
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error('Configure Resend or Gmail email credentials.');
    }

    return transporter.sendMail({
        from: `"MamaCloset" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text
    });
}

module.exports = sendEmail;
