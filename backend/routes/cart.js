const express = require('express');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth } = require('../middleware/auth');
const { fail } = require('../utils/helpers');

const HOLD_MINUTES = 30;
const MAX_QTY = 10;
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

router.use(requireAuth);

const inTx = async (fn) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const out = await fn(conn);
        await conn.commit();
        return out;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ei size e wantedQty ta nite parbe ki na (onno-der hold bad diye) dekhe
const checkAvailable = async (conn, userId, productId, color, size, wantedQty) => {
    const [p] = await conn.query('SELECT id FROM products WHERE id = ? AND is_active = TRUE', [productId]);
    if (!p.length) throw fail(404, 'Product not found.');

    const [s] = await conn.query(
        'SELECT stock FROM product_sizes WHERE product_id = ? AND color = ? AND size = ? FOR UPDATE',
        [productId, color, size]
    );
    if (!s.length) throw fail(400, 'This color and size combination is not available.');

    const [[h]] = await conn.query(
        `SELECT COALESCE(SUM(quantity), 0) AS held FROM cart_items
         WHERE product_id = ? AND color = ? AND size = ? AND user_id <> ? AND expires_at > NOW()`,
        [productId, color, size, userId]
    );
    const available = s[0].stock - Number(h.held);
    if (wantedQty > available) {
        throw fail(400, available <= 0
            ? 'Sorry, this color and size are sold out or reserved by someone else right now.'
            : `Only ${available} available right now.`);
    }
};

// cart dekha
router.get('/', wrap(async (req, res) => {
    const [rows] = await db.query(
        `SELECT c.id, c.product_id, c.color, c.size, c.quantity,
                TIMESTAMPDIFF(SECOND, NOW(), c.expires_at) AS seconds_left,
                p.name, p.price, p.discount_percent, p.image_front,
                (SELECT stock FROM product_sizes ps
                 WHERE ps.product_id = c.product_id AND ps.color = c.color AND ps.size = c.size) AS stock
         FROM cart_items c JOIN products p ON p.id = c.product_id
         WHERE c.user_id = ? AND c.expires_at > NOW()
         ORDER BY c.id`,
        [req.user.id]
    );
    res.json({
        items: rows.map((r) => ({
            id: r.id,
            product_id: r.product_id,
            name: r.name,
            color: r.color,
            size: r.size,
            quantity: r.quantity,
            price: Math.round(Number(r.price) * (100 - r.discount_percent)) / 100,
            image: r.image_front,
            max: Math.min(MAX_QTY, r.stock || 0),
            seconds_left: Math.max(0, r.seconds_left)
        }))
    });
}));

// cart e add (30 min hold shuru)
router.post('/', wrap(async (req, res) => {
    const productId = Number(req.body.product_id);
    const color = String(req.body.color || '').trim();
    const size = String(req.body.size || '').toUpperCase();
    const qty = Number(req.body.quantity || 1);

    if (!Number.isInteger(productId) || !color || color.length > 40
        || /[\u0000-\u001f\u007f]/.test(color) || !SIZES.includes(size)
        || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw fail(400, 'Invalid item.');
    }

    await inTx(async (conn) => {
        await conn.query('DELETE FROM cart_items WHERE user_id = ? AND expires_at <= NOW()', [req.user.id]);

        const [ex] = await conn.query(
            'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND color = ? AND size = ?',
            [req.user.id, productId, color, size]
        );
        const total = (ex[0] ? ex[0].quantity : 0) + qty;
        if (total > MAX_QTY) throw fail(400, `You can buy at most ${MAX_QTY} of one item.`);

        await checkAvailable(conn, req.user.id, productId, color, size, total);

        if (ex.length) {
            await conn.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [total, ex[0].id]);
        } else {
            await conn.query(
                `INSERT INTO cart_items (user_id, product_id, color, size, quantity, expires_at)
                 VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
                [req.user.id, productId, color, size, qty, HOLD_MINUTES]
            );
        }
    });
    res.status(201).json({ message: `Added. Reserved for you for ${HOLD_MINUTES} minutes.` });
}));

// quantity bodlano
router.patch('/:id', wrap(async (req, res) => {
    const id = Number(req.params.id);
    const qty = Number(req.body.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw fail(400, 'Invalid quantity.');
    }
    await inTx(async (conn) => {
        const [rows] = await conn.query(
            'SELECT product_id, color, size FROM cart_items WHERE id = ? AND user_id = ? AND expires_at > NOW()',
            [id, req.user.id]
        );
        if (!rows.length) throw fail(404, 'Item not found or its reservation expired.');
        await checkAvailable(conn, req.user.id, rows[0].product_id, rows[0].color, rows[0].size, qty);
        await conn.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, id]);
    });
    res.json({ message: 'Updated.' });
}));

// remove (hold sathe sathe chere dey)
router.delete('/:id', wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw fail(404, 'Item not found.');
    await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Removed.' });
}));

// checkout e gele somoy abar 30 min (prottek item e shudhu ekbar)
router.post('/checkout-start', wrap(async (req, res) => {
    await db.query(
        `UPDATE cart_items SET expires_at = NOW() + INTERVAL ? MINUTE, extended = TRUE
         WHERE user_id = ? AND expires_at > NOW() AND extended = FALSE`,
        [HOLD_MINUTES, req.user.id]
    );
    res.json({ ok: true });
}));

module.exports = router;