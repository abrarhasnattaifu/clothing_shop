const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const wrap = require('../middleware/wrap');
const { clean, isEmail, fail } = require('../utils/helpers');

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
    const [result] = await db.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, passwordHash]
    );
    const [users] = await db.query(
        'SELECT id, name, email, role, profile_image FROM users WHERE id = ?',
        [result.insertId]
    );
    const user = users[0];
    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.status(201).json({
        message: 'Registration successful.',
        token,
        user
    });
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