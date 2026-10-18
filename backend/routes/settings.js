const express = require('express');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { fail, isEmail } = require('../utils/helpers');

const MAX = {
    shop_about: 300,
    phone: 20,
    whatsapp: 20,
    telegram: 50,
    email: 100,
    address: 200,
    hours: 100,
    facebook: 200,
    instagram: 200,
    delivery_note: 200,
    return_note: 200
};

const readAll = async () => {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM site_settings');
    const out = Object.fromEntries(Object.keys(MAX).map((k) => [k, '']));
    rows.forEach((r) => {
        if (r.setting_key in out) out[r.setting_key] = r.setting_value;
    });
    return out;
};

const normalize = (key, raw) => {
    let v = String(raw ?? '').trim();
    if (v.length > MAX[key]) throw fail(400, `${key} is too long (max ${MAX[key]} characters).`);
    if (!v) return '';

    if (key === 'phone') {
        if (!/^[0-9+\s-]{6,20}$/.test(v)) throw fail(400, 'Enter a valid phone number.');
    }
    if (key === 'whatsapp') {
        let d = v.replace(/\D/g, '');
        if (/^01\d{9}$/.test(d)) d = '88' + d;
        if (!/^8801\d{9}$/.test(d)) throw fail(400, 'WhatsApp number must look like 01XXXXXXXXX.');
        v = d;
    }
    if (key === 'telegram') {
        v = v.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
        if (!/^[A-Za-z0-9_]{5,32}$/.test(v)) throw fail(400, 'Enter your Telegram username (5-32 letters, numbers or _).');
    }
    if (key === 'email') {
        v = v.toLowerCase();
        if (!isEmail(v)) throw fail(400, 'Enter a valid email.');
    }
    if (key === 'facebook' || key === 'instagram') {
        if (!/^https:\/\/\S+$/.test(v)) throw fail(400, `${key} link must start with https://`);
    }
    return v;
};

router.get('/', wrap(async (req, res) => {
    res.json({ settings: await readAll() });
}));

router.put('/', requireAuth, requireAdmin, wrap(async (req, res) => {
    const entries = [];
    for (const key of Object.keys(MAX)) {
        if (req.body[key] === undefined) continue;
        entries.push([key, normalize(key, req.body[key])]);
    }
    if (!entries.length) throw fail(400, 'Nothing to save.');

    await db.query(
        `INSERT INTO site_settings (setting_key, setting_value) VALUES ?
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [entries]
    );
    res.json({ message: 'Saved.', settings: await readAll() });
}));

module.exports = router;