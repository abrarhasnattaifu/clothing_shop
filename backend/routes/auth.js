const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const wrap = require('../middleware/wrap');
const { hash, clean, isEmail, fail } = require('../utils/helpers');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
});

const sendCode = async (email, purpose, pendingName = null, pendingPasswordHash = null) => {
    const [recent] = await db.query(
        `SELECT id FROM login_codes
         WHERE email = ?
         AND created_at > NOW() - INTERVAL 60 SECOND`,
        [email]
    );
    if (recent.length) {
        throw fail(429, 'Please wait a minute before requesting a new code');
    }

    const code = crypto.randomInt(100000, 1000000);

    // FIX: result ta ekhane dhorte hobe, nahole niche result.insertId error dey
    const [result] = await db.query(
        `INSERT INTO login_codes
        (email, code_hash, expires_at, purpose, pending_name, pending_password_hash)
        VALUES (?, ?, NOW() + INTERVAL 10 MINUTE, ?, ?, ?)`,
        [email, hash(String(code)), purpose, pendingName, pendingPasswordHash]
    );

    try {
        await transporter.sendMail({
            from: '"Clothing Shop" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: 'Your Login Code',
            text: `Your login code is: ${code}. It will expire in 10 minutes.`
        });
    } catch (error) {
        // email na gele code ta muche dao, jate user sathe sathe abar chaite pare
        await db.query('DELETE FROM login_codes WHERE id = ?', [result.insertId]);
        console.error('Email send failed:', error.message);
        throw fail(500, 'Could not send the email. Please try again later.');
    }
};

// register route
router.post('/register', wrap(async (req, res) => {
    // FIX: name ke lowercase kora jabe na (clean() lowercase kore)
    const name = String(req.body.name || '').trim();
    const email = clean(req.body.email);
    const pass = String(req.body.password || '').trim();

    if (!name || !isEmail(email)) {
        throw fail(400, 'Invalid name or email');
    }
    if (pass.length < 8 || pass.length > 72) {
        throw fail(400, 'Password must be 8 to 72 characters long.');
    }

    const [existing] = await db.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
    );
    if (existing.length) {
        throw fail(400, 'Email already registered');
    }

    // FIX: pass diye hash korte hobe. age clean(password) chilo, ta password ke lowercase kore dito
    const passwordHash = await bcrypt.hash(pass, 12);
    await sendCode(email, 'register', name, passwordHash);
    res.json({ message: 'Please check your email for the registration code.' });
}));

// login route
router.post('/login', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const password = String(req.body.password || '').trim();

    if (!isEmail(email) || !password) {
        throw fail(400, 'Enter a valid email and password.');
    }

    const [users] = await db.query(
        'SELECT id, password_hash FROM users WHERE email = ?',
        [email]
    );

    if (!users.length || !users[0].password_hash) {
        throw fail(404, 'Invalid email or password. Please register first.');
    }

    const isMatch = await bcrypt.compare(password, users[0].password_hash);
    if (!isMatch) {
        throw fail(400, 'Invalid email or password.');
    }

    await sendCode(email, 'login');
    res.json({ message: 'Verification code sent. Please check your email.' });
}));

// verify code route
router.post('/verify', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const code = String(req.body.code || '').trim();
    const purpose = clean(req.body.purpose);

    if (!isEmail(email) || !/^\d{6}$/.test(code) || !['login', 'register'].includes(purpose)) {
        throw fail(400, 'Enter a valid email and 6-digit code.');
    }

    const [rows] = await db.query(
        `SELECT * FROM login_codes
         WHERE email = ?
         AND purpose = ?
         AND used = FALSE
         AND expires_at > NOW()
         ORDER BY id DESC
         LIMIT 1`,
        [email, purpose]
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

    let user;
    if (purpose === 'register') {
        if (!row.pending_name || !row.pending_password_hash) {
            throw fail(400, 'Invalid registration data.');
        }
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        if (existing.length) {
            throw fail(400, 'Email already registered.');
        }
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [row.pending_name, email, row.pending_password_hash]
        );
        const [users] = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [result.insertId]
        );
        user = users[0];
    } else {
        const [users] = await db.query(
            'SELECT id, name, email, role FROM users WHERE email = ?',
            [email]
        );
        user = users[0];
        if (!user) {
            throw fail(404, 'User not found. Please register first.');
        }
    }

    await db.query('UPDATE login_codes SET used = TRUE WHERE id = ?', [row.id]);

    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({
        message: purpose === 'register' ? 'Registration successful.' : 'Login successful.',
        token,
        user
    });
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
        payload = jwt.verify(match[1], process.env.JWT_SECRET);
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