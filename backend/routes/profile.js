const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth } = require('../middleware/auth');
const profileUpload = require('../middleware/profileUpload');
const { fail } = require('../utils/helpers');

const removeUpload = (url) => {
    if (!url || !url.startsWith('/uploads/profile-')) return;
    fs.unlink(path.join(__dirname, '..', 'uploads', path.basename(url)), (error) => {
        if (error && error.code !== 'ENOENT') console.error('Profile photo cleanup failed:', error.message);
    });
};

router.get('/me', requireAuth, wrap(async (req, res) => {
    const offset = Number(req.query.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw fail(400, 'Invalid activity offset.');
    const [users] = await db.query(
        `SELECT id, name, email, role, phone, address, profile_image, created_at
         FROM users WHERE id = ?`,
        [req.user.id]
    );
    if (!users.length) throw fail(404, 'Profile not found.');

    const [activities] = await db.query(
        `SELECT 'Order' AS activity_type, o.order_code AS reference,
                CONCAT('Order status: ', o.order_status,
                    IF(o.refund_requested, ' · Refund requested', ''),
                    IF(o.refunded, ' · Refunded', '')) AS description,
                o.created_at
         FROM orders o WHERE o.user_id = ?
         ORDER BY o.created_at DESC LIMIT 51 OFFSET ?`,
        [req.user.id, offset]
    );
    const hasMore = activities.length > 50;
    res.json({ profile: users[0], activities: activities.slice(0, 50), has_more: hasMore });
}));

router.put('/me', requireAuth, profileUpload, wrap(async (req, res) => {
    const nextImage = req.file ? `/uploads/${req.file.filename}` : null;
    let saved = false;
    try {
        const name = String(req.body.name || '').trim();
        const phone = String(req.body.phone || '').trim();
        const address = String(req.body.address || '').trim();
        if (name.length < 2 || name.length > 100) throw fail(400, 'Name must be between 2 and 100 characters.');
        if (phone && !/^\+?[0-9\s()-]{7,20}$/.test(phone)) throw fail(400, 'Enter a valid phone number.');
        if (address.length > 500) throw fail(400, 'Address must be 500 characters or fewer.');

        const conn = await db.getConnection();
        let previousImage;
        try {
            await conn.beginTransaction();
            const [users] = await conn.query(
                'SELECT profile_image FROM users WHERE id = ? FOR UPDATE',
                [req.user.id]
            );
            if (!users.length) throw fail(404, 'Profile not found.');
            previousImage = users[0].profile_image;
            await conn.query(
                `UPDATE users SET name = ?, phone = ?, address = ?,
                 profile_image = COALESCE(?, profile_image) WHERE id = ?`,
                [name, phone || null, address || null, nextImage, req.user.id]
            );
            await conn.commit();
            saved = true;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

        const [users] = await db.query(
            'SELECT id, name, email, role, phone, address, profile_image, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (nextImage && previousImage !== nextImage) removeUpload(previousImage);
        res.json({ message: 'Profile updated.', profile: users[0] });
    } catch (error) {
        if (req.file && !saved) removeUpload(nextImage);
        throw error;
    }
}));

module.exports = router;
