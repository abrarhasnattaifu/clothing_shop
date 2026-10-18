const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { fail } = require('../utils/helpers');
const { notifyAdmin, notifyBuyer } = require('../utils/notify');

const RETURN_DAYS = Number(process.env.RETURN_DAYS || 3);
const PROBLEMS = ['wrong_size', 'damaged', 'wrong_item', 'quality', 'not_as_described', 'other'];

const makeCode = async (conn) => {
    for (let i = 0; i < 5; i++) {
        const code = 'RT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const [r] = await conn.query('SELECT id FROM return_requests WHERE request_code = ?', [code]);
        if (!r.length) return code;
    }
    throw fail(500, 'Could not create a request code. Try again.');
};

const loadEligible = async (conn, code, userId, lock = false) => {
    const [orders] = await conn.query(
        `SELECT id, order_code, order_status, delivered_at,
                TIMESTAMPDIFF(HOUR, delivered_at, NOW()) AS hours
         FROM orders WHERE order_code = ? AND user_id = ?${lock ? ' FOR UPDATE' : ''}`,
        [String(code || '').trim().toUpperCase(), userId]
    );
    if (!orders.length) throw fail(404, 'Order not found. Please check the order code.');
    const o = orders[0];
    if (o.order_status !== 'delivered') {
        throw fail(400, 'A return is possible only after the order is delivered.');
    }
    if (!o.delivered_at || o.hours > RETURN_DAYS * 24) {
        throw fail(400, `The ${RETURN_DAYS}-day return window for this order has ended.`);
    }

    const [rows] = await conn.query(
        `SELECT oi.id, oi.product_name, oi.color, oi.size, oi.quantity, oi.unit_price,
                oi.quantity - COALESCE((
                    SELECT SUM(r.quantity) FROM return_requests r
                    WHERE r.order_item_id = oi.id AND r.status <> 'rejected'
                ), 0) AS remaining
         FROM order_items oi WHERE oi.order_id = ?`,
        [o.id]
    );
    const items = rows.map((r) => ({ ...r, remaining: Number(r.remaining) }));
    return { order: o, items };
};

router.get('/order/:code', requireAuth, wrap(async (req, res) => {
    const { order, items } = await loadEligible(db, req.params.code, req.user.id);
    const left = Math.max(0, Math.floor(RETURN_DAYS - order.hours / 24));
    res.json({
        order_code: order.order_code,
        days_left: left,
        items: items.filter((i) => i.remaining > 0)
    });
}));

router.post('/', requireAuth, wrap(async (req, res) => {
    const b = req.body;
    const type = String(b.type || '');
    const itemId = Number(b.item_id);
    const qty = Number(b.quantity);
    const problem = String(b.problem || '');
    const details = String(b.details || '').trim();
    const reason = String(b.reason || '').trim();

    if (type !== 'return') throw fail(400, 'Only product returns are accepted.');
    if (!Number.isInteger(itemId)) throw fail(400, 'Choose the product.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw fail(400, 'Enter a valid quantity.');
    if (!PROBLEMS.includes(problem)) throw fail(400, 'Choose the problem.');
    if (details.length < 10 || details.length > 500) {
        throw fail(400, 'Please describe the problem (at least 10 characters).');
    }
    if (reason.length < 5 || reason.length > 300) {
        throw fail(400, 'Please write why you want this (at least 5 characters).');
    }
    const conn = await db.getConnection();
    let result;
    try {
        await conn.beginTransaction();
        const { order, items } = await loadEligible(conn, b.order_code, req.user.id, true);
        const item = items.find((i) => i.id === itemId);
        if (!item) throw fail(400, 'This product is not in that order.');
        if (qty > item.remaining) {
            throw fail(400, item.remaining <= 0
                ? 'A request for this product already exists.'
                : `You can request at most ${item.remaining} of this product.`);
        }

        const code = await makeCode(conn);
        const [r] = await conn.query(
            `INSERT INTO return_requests
             (request_code, order_id, order_item_id, user_id, type, quantity, problem, details, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, order.id, item.id, req.user.id, 'return', qty, problem, details, reason]
        );
        await conn.commit();
        result = { id: r.insertId, code, orderCode: order.order_code, product: item.product_name };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    notifyAdmin(
        `New return request ${result.code}: ${result.product} (order ${result.orderCode})`,
        null
    ).catch((e) => console.error('notify failed:', e.message));
    notifyBuyer(
        req.user.id,
        `Your return request ${result.code} for order ${result.orderCode} has been received.`,
        null,
        result.id
    ).catch((e) => console.error('Buyer notification failed:', e.message));

    res.status(201).json({ request_code: result.code, message: 'Request sent. We will check and contact you.' });
}));

router.get('/mine', requireAuth, wrap(async (req, res) => {
    const [rows] = await db.query(
        `SELECT r.request_code, r.type, r.quantity, r.problem, r.status, r.admin_note, r.created_at,
                o.order_code, oi.product_name, oi.color, oi.size
         FROM return_requests r
         JOIN orders o ON o.id = r.order_id
         JOIN order_items oi ON oi.id = r.order_item_id
         WHERE r.user_id = ? ORDER BY r.id DESC LIMIT 50`,
        [req.user.id]
    );
    res.json({ requests: rows });
}));

router.get('/admin/all', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [rows] = await db.query(
        `SELECT r.*, o.order_code, o.customer_name, o.phone, o.payment_method, o.payment_status,
                oi.product_name, oi.color, oi.size, oi.unit_price,
                u.name AS account_name, u.email AS account_email
         FROM return_requests r
         JOIN orders o ON o.id = r.order_id
         JOIN order_items oi ON oi.id = r.order_item_id
         JOIN users u ON u.id = r.user_id
         ORDER BY r.id DESC LIMIT 200`
    );
    res.json({ requests: rows });
}));

router.patch('/admin/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
    const id = Number(req.params.id);
    const action = String(req.body.action || '');
    const note = String(req.body.note || '').trim().slice(0, 300);
    const restock = req.body.restock === true;
    if (!Number.isInteger(id)) throw fail(404, 'Request not found.');
    if (!['approve', 'reject', 'complete'].includes(action)) throw fail(400, 'Invalid action.');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT r.*, oi.product_id, oi.color AS item_color, oi.size AS item_size
             FROM return_requests r JOIN order_items oi ON oi.id = r.order_item_id
             WHERE r.id = ? FOR UPDATE`,
            [id]
        );
        if (!rows.length) throw fail(404, 'Request not found.');
        const r = rows[0];
        let nextStatus;

        if (action === 'complete') {
            if (r.status !== 'approved') throw fail(400, 'Approve the request first.');
            if (restock) {
                await conn.query(
                    `INSERT INTO product_sizes (product_id, color, size, stock) VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
                    [r.product_id, r.item_color, r.item_size, r.quantity]
                );
                if (r.type === 'return') {
                    await conn.query(
                        'UPDATE products SET sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?',
                        [r.quantity, r.product_id]
                    );
                }
            }
            await conn.query(
                "UPDATE return_requests SET status = 'completed', admin_note = COALESCE(?, admin_note) WHERE id = ?",
                [note || null, id]
            );
            nextStatus = 'completed';
        } else {
            if (r.status !== 'pending') throw fail(400, 'This request was already reviewed.');
            await conn.query(
                'UPDATE return_requests SET status = ?, admin_note = ? WHERE id = ?',
                [action === 'approve' ? 'approved' : 'rejected', note || null, id]
            );
            nextStatus = action === 'approve' ? 'approved' : 'rejected';
        }
        await conn.commit();
        notifyBuyer(
            r.user_id,
            `Your return request ${r.request_code} was ${nextStatus}.${note ? ` Note: ${note}` : ''}`,
            null,
            r.id
        ).catch((e) => console.error('Buyer notification failed:', e.message));
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    res.json({ message: 'Updated.' });
}));

module.exports = router;