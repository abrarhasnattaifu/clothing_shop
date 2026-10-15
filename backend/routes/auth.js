const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const wrap = require('../middleware/wrap');
const { hash, clean, isEmail, fail } = require('../utils/helpers');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
});

sendCode = async(email) => {
    const [recent] = await db.query(
       `SELECT id FROM login_codes
         WHERE email = ?
         AND created_at > NOW() - INTERVAL 60 SECOND`,
        [email] 
    );
    if (recent.lenght) {
        throw fail(429, 'Please wait a minute before requesting a new code');
    }
    const code = Math.floor(100000 + Math.random() * 900000);
    await db.query(
        `INSERT INTO login_codes
         (email, code_hash, expires_at)
         VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)`,
        [email, hash(code)]
    );
    await transporter.sendMail({

        from: '"Clothing Shop" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'Your Login Code',
        text: `Your login code is: ${code}. it will expire in 10 minutes.`
    });
}

// register route
router.post('/register', wrap(async (req, res) => {
    const name = clean(req.body.name);
    const email = clean(req.body.email);

    if (!name || !isEmail(email)) {
        throw fail(400, 'Invalid name or email');
    }
    const [existing] = await db.query(
        `SELECT id FROM users WHERE email = ?`,
        [email]
    );
    if (existing.length) {
        throw fail(400, 'Email already registered');
    }
    await sendCode(email);
    await db.query(
        `INSERT INTO users (name, email) VALUES (?, ?)`,
        [name, email]
    );
    res.json({ message: 'Registration successful. Please check your email for the login code.' });
}));

router.post('/login', wrap(async (req, res) => {
    const email = clean(req.body.email);

    if (!isEmail(email)) {
        throw fail(400, 'Enter a valid email.');
    }

    const [users] = await db.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
    );

    if (!users.length) {
        throw fail(
            404,
            'No account with this email. Sign up first.'
        );
    }

    await sendCode(email);
    res.json({ message: 'Login code sent. Please check your email.' });
}));

// verify code route
router.post('/verify', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const code = String(req.body.code || '').trim();
    if (!isEmail(email) || !/^\d{6}$/.test(code)) {
        throw fail(400, 'Enter a valid email and 6-digit code.');
    }
    const [rows] = await db.query(
        `SELECT * FROM login_codes
         WHERE email = ?
         AND used = FALSE
         AND expires_at > NOW()
         ORDER BY id DESC
         LIMIT 1`,
        [email]
    );

    const row = rows[0];

    if (!row) {
        throw fail(400, 'Code expired. Ask for a new one.');
    }

    if (row.attempts >= 5) {
        throw fail(429, 'Too many wrong tries. Ask for a new code.');
    }
    if (row.code_hash !== hash(code)) {
        await db.query(
            'UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?',
            [row.id]
        );

        throw fail(400, 'Wrong code. Try again.');
    }
    await db.query(
        'UPDATE login_codes SET used = TRUE WHERE id = ?',
        [row.id]
    );

    const [users] = await db.query(
        'SELECT id, name, email, role FROM users WHERE email = ?',
        [email]
    );

    const user = users[0];

    if (!user) {
        throw fail(401, 'Please log in.');
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ token, user });
}));

// get logged-in user
router.get('/me', wrap(async (req, res) => {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        throw fail(401, 'Please log in.');
    }

    let payload;

    try {
        payload = jwt.verify(
            match[1],
            process.env.JWT_SECRET
        );
    } catch {
        throw fail(401, 'Please log in.');
    }

    const [users] = await db.query(
        'SELECT id, name, email, role FROM users WHERE id = ?',
        [payload.id]
    );

    if (!users.length) {
        throw fail(401, 'Please log in.');
    }

    res.json({ user: users[0] });
}));

module.exports = router;

