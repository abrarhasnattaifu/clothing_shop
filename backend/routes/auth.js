const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const wrap = require('../middleware/wrap');
const { hash, clean, isEmail, fail } = require('../utils/helpers');
const sendEmail = require('../utils/sendEmail');

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
    const [result] = await db.query(
        `INSERT INTO login_codes
        (email, code_hash, expires_at, purpose, pending_name, pending_password_hash)
        VALUES (?, ?, NOW() + INTERVAL 10 MINUTE, ?, ?, ?)`,
        [email, hash(String(code)), purpose, pendingName, pendingPasswordHash]
    );

    try {
        await sendEmail({
            to: email,
            subject: 'Your MamaCloset Registration Code',
            text: `Your login code is: ${code}. It will expire in 10 minutes.`
        });
    } catch (error) {
        await db.query('DELETE FROM login_codes WHERE id = ?', [result.insertId]);
        console.error('Email send failed:', error.message);
        throw fail(500, 'Could not send the email. Please try again later.');
    }
};

router.post('/register', wrap(async (req, res) => {
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

    const passwordHash = await bcrypt.hash(pass, 12);
    await sendCode(email, 'register', name, passwordHash);
    res.json({ message: 'Please check your email for the registration code.' });
}));

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

    const [authenticatedUsers] = await db.query(
        'SELECT id, name, email, role, profile_image FROM users WHERE id = ?',
        [users[0].id]
    );
    const user = authenticatedUsers[0];
    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful.', token, user });
}));

router.post('/verify', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const code = String(req.body.code || '').trim();
    const purpose = clean(req.body.purpose);

    if (!isEmail(email) || !/^\d{6}$/.test(code) || purpose !== 'register') {
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
        'SELECT id, name, email, role, profile_image FROM users WHERE id = ?',
        [result.insertId]
    );
    const user = users[0];

    await db.query('UPDATE login_codes SET used = TRUE WHERE id = ?', [row.id]);

    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({
        message: 'Registration successful.',
        token,
        user
    });
}));

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
        'SELECT id, name, email, role, profile_image FROM users WHERE id = ?',
        [payload.id]
    );

    if (!users.length) {
        throw fail(401, 'Please log in.');
    }

    res.json({ user: users[0] });
}));

module.exports = router;