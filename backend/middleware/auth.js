const jwt = require('jsonwebtoken');
const db = require('../db');
const { fail } = require('../utils/helpers');
const wrap = require('./wrap');
const requireAuth = wrap(async (req, res, next) => {
    const match = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);

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
    req.user = users[0];
    next();
});

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        throw fail(403, 'Access denied.');
    }
    next();
};

module.exports = { requireAuth, requireAdmin };