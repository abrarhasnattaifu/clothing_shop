const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { fail } = require('../utils/helpers');
const { notifyAdmin } = require('../utils/notify');
const { HOLD_MIN } = require('../utils/payConfig');

const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 0);
const METHODS = ['cod', 'bkash', 'rocket'];
const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

router.get('/payment-info', (req, res) => {
    res.json({
        bkash: process.env.BKASH_NUMBER || '',
        rocket: process.env.ROCKET_NUMBER || '',
        delivery_fee: DELIVERY_FEE,
        hold_minutes: HOLD_MIN
    });
});

// customer er nijer shob order, obostha shoho (My Orders page er jonno)
router.get('/mine', requireAuth, wrap(async (req, res) => {
    const [orders] = await db.query(
        `SELECT id, order_code, total, payment_method, payment_status, order_status, trx_id, created_at
         FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
        [req.user.id]
    );
    if (!orders.length) return res.json({ orders: [], hold_minutes: HOLD_MIN });

    const [items] = await db.query(
        'SELECT order_id, product_name, size, quantity, unit_price FROM order_items WHERE order_id IN (?)',
        [orders.map((o) => o.id)]
    );
    res.json({
        hold_minutes: HOLD_MIN,
        orders: orders.map(({ id, ...o }) => ({
            ...o,
            total: Number(o.total),
            items: items
                .filter((i) => i.order_id === id)
                .map((i) => ({
                    product_name: i.product_name,
                    size: i.size,
                    quantity: i.quantity,
                    unit_price: Number(i.unit_price)
                }))
        }))
    });
}));

const makeCode = async (conn) => {
    for (let i = 0; i < 5; i++) {
        const code = 'CL-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const [r] = await conn.query('SELECT id FROM orders WHERE order_code = ?', [code]);
        if (!r.length) return code;
    }
    throw fail(500, 'Could not create an order code. Try again.');
};

const restoreStock = async (conn, orderId) => {
    const [items] = await conn.query(
        'SELECT product_id, size, quantity FROM order_items WHERE order_id = ?',
        [orderId]
    );
    for (const it of items) {
        await conn.query(
            'UPDATE product_sizes SET stock = stock + ? WHERE product_id = ? AND size = ?',
            [it.quantity, it.product_id, it.size]
        );
        await conn.query(
            'UPDATE products SET sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?',
            [it.quantity, it.product_id]
        );
    }
};

// order lock kore kaj korar helper
const changeOrder = async (id, fn) => {
    if (!Number.isInteger(id)) throw fail(404, 'Order not found.');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) throw fail(404, 'Order not found.');
        await fn(conn, rows[0]);
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ---------- customer: order dewa ----------
router.post('/', requireAuth, wrap(async (req, res) => {
    const b = req.body;
    const name = String(b.name || '').trim();
    const phone = String(b.phone || '').replace(/[\s-]/g, '').replace(/^\+?88/, '');
    const address = String(b.address || '').trim();
    const note = String(b.note || '').trim().slice(0, 300);
    const method = String(b.payment_method || '');
    const trxId = String(b.trx_id || '').trim().toUpperCase();
    // customer jei number theke taka pathalo
    const payNumber = String(b.pay_number || '').replace(/[\s-]/g, '').replace(/^\+?88/, '');

    if (name.length < 2 || name.length > 100) throw fail(400, 'Enter your name.');
    if (!/^01\d{9}$/.test(phone)) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX).');
    if (address.length < 10 || address.length > 500) throw fail(400, 'Enter your full delivery address.');
    if (!METHODS.includes(method)) throw fail(400, 'Choose a payment method.');
    if (method !== 'cod' && !/^[A-Z0-9]{6,20}$/.test(trxId)) throw fail(400, 'Enter a valid TrxID.');
    if (method !== 'cod' && !/^01\d{9}$/.test(payNumber)) throw fail(400, 'Enter the number you sent the money from.');

    const conn = await db.getConnection();
    let result;
    try {
        await conn.beginTransaction();

        // item gulo ashbe server er cart (hold) theke
        const [cart] = await conn.query(
            'SELECT product_id, size, quantity FROM cart_items WHERE user_id = ? AND expires_at > NOW() FOR UPDATE',
            [req.user.id]
        );
        if (!cart.length) {
            throw fail(400, 'Your cart is empty or the 30-minute reservation has expired. Please add the items again.');
        }

        const items = [];
        let subtotal = 0;
        for (const l of cart) {
            const [p] = await conn.query(
                'SELECT id, name, price, discount_percent FROM products WHERE id = ? AND is_active = TRUE',
                [l.product_id]
            );
            if (!p.length) throw fail(400, 'A product in your cart is no longer available.');

            const [u] = await conn.query(
                'UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND size = ? AND stock >= ?',
                [l.quantity, l.product_id, l.size, l.quantity]
            );
            if (!u.affectedRows) {
                throw fail(400, `${p[0].name} (${l.size}) is out of stock or not enough quantity.`);
            }
            await conn.query('UPDATE products SET sold_count = sold_count + ? WHERE id = ?', [l.quantity, l.product_id]);

            const unit = Math.round(Number(p[0].price) * (100 - p[0].discount_percent)) / 100;
            subtotal += unit * l.quantity;
            items.push([l.product_id, p[0].name, l.size, l.quantity, unit]);
        }
        subtotal = Math.round(subtotal * 100) / 100;
        const total = Math.round((subtotal + DELIVERY_FEE) * 100) / 100;
        const code = await makeCode(conn);

        let payStatus = 'unpaid';
        let orderStatus = 'confirmed'; // COD sathe sathe confirm

        if (method !== 'cod') {
            payStatus = 'verifying';
            orderStatus = 'pending';

            const [sms] = await conn.query(
                `SELECT *, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS age_min
                 FROM payment_sms WHERE trx_id = ? FOR UPDATE`,
                [trxId]
            );
            if (sms.length) {
                const s = sms[0];
                if (s.method !== method) throw fail(400, `This TrxID is not a ${method} payment.`);
                if (s.used) throw fail(400, 'This TrxID was already used.');
                if (s.age_min > HOLD_MIN) throw fail(400, 'This payment is too old. Please contact us.');
                // SMS e number thakle customer er deya number er shathe milte hobe (onner TrxID chilie nite parbe na)
                if (s.from_number && s.from_number !== payNumber) {
                    throw fail(400, 'The number you entered does not match the number that sent this payment.');
                }
                if (!sameAmount(s.amount, total)) {
                    throw fail(400, `You paid ৳${s.amount} but the order total is ৳${total}. Please contact us.`);
                }
                await conn.query('UPDATE payment_sms SET used = TRUE WHERE id = ?', [s.id]);
                payStatus = 'paid';
                orderStatus = 'confirmed';
            }
        }

        const [r] = await conn.query(
            `INSERT INTO orders
             (order_code, user_id, customer_name, phone, address, note, payment_method, trx_id, pay_number,
              subtotal, delivery_fee, total, payment_status, order_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                code, req.user.id, name, phone, address, note || null, method,
                method === 'cod' ? null : trxId,
                method === 'cod' ? null : payNumber,
                subtotal, DELIVERY_FEE, total, payStatus, orderStatus
            ]
        );
        await conn.query(
            'INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price) VALUES ?',
            [items.map((i) => [r.insertId, ...i])]
        );

        // hold ta ekhon asol order e poriborton hoyeche, cart khali
        await conn.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

        await conn.commit();
        result = { id: r.insertId, code, total, payStatus, orderStatus };
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') throw fail(400, 'This TrxID was already used.');
        throw err;
    } finally {
        conn.release();
    }

    notifyAdmin(
        `New order ${result.code}: ৳${result.total} (${method.toUpperCase()}) from ${name}, ${phone}`,
        result.id
    ).catch((e) => console.error('notify failed:', e.message));

    res.status(201).json({
        order_code: result.code,
        total: result.total,
        payment_status: result.payStatus,
        order_status: result.orderStatus
    });
}));

// ---------- admin ----------
router.get('/admin/all', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [orders] = await db.query(
        `SELECT o.*, u.name AS account_name, u.email AS account_email
         FROM orders o JOIN users u ON u.id = o.user_id
         ORDER BY o.id DESC LIMIT 200`
    );
    if (!orders.length) return res.json({ orders: [] });

    const [items] = await db.query(
        'SELECT order_id, product_name, size, quantity, unit_price FROM order_items WHERE order_id IN (?)',
        [orders.map((o) => o.id)]
    );
    res.json({
        orders: orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }))
    });
}));

router.get('/admin/notifications', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [list] = await db.query(
        'SELECT id, message, order_id, is_read, created_at FROM notifications ORDER BY id DESC LIMIT 30'
    );
    const [[c]] = await db.query('SELECT COUNT(*) AS n FROM notifications WHERE is_read = FALSE');
    res.json({ notifications: list, unread: c.n });
}));

router.post('/admin/notifications/read', requireAuth, requireAdmin, wrap(async (req, res) => {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    res.json({ ok: true });
}));

router.patch('/admin/:id/status', requireAuth, requireAdmin, wrap(async (req, res) => {
    const next = String(req.body.order_status || '');
    if (!['confirmed', 'shipped', 'delivered', 'cancelled'].includes(next)) {
        throw fail(400, 'Invalid status.');
    }
    await changeOrder(Number(req.params.id), async (conn, order) => {
        if (order.order_status === 'cancelled') throw fail(400, 'Cancelled orders cannot be changed.');

        // FIX: taka confirm na hole confirm/ship/deliver kora jabe na (COD bade)
        if (next !== 'cancelled' && order.payment_method !== 'cod' && order.payment_status !== 'paid') {
            throw fail(400, 'Payment is not confirmed yet. Approve the payment first.');
        }

        if (next === 'cancelled') {
            // FIX: verifying payment o "rejected" kore dei, nahole pore SMS eshe order abar jibito kore felto
            await conn.query(
                `UPDATE orders SET order_status = 'cancelled',
                 payment_status = IF(payment_status = 'verifying', 'rejected', payment_status)
                 WHERE id = ?`,
                [order.id]
            );
            await restoreStock(conn, order.id);
        } else {
            // FIX: COD order delivered hole taka pawa gelo dhora hoy
            const paidNow = next === 'delivered' && order.payment_method === 'cod';
            await conn.query(
                'UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?',
                [next, paidNow ? 'paid' : order.payment_status, order.id]
            );
        }
    });
    res.json({ message: 'Status updated.' });
}));

// SMS na ashle admin nijer hate payment approve/reject korte parbe
router.patch('/admin/:id/payment', requireAuth, requireAdmin, wrap(async (req, res) => {
    const action = String(req.body.action || '');
    if (!['approve', 'reject'].includes(action)) throw fail(400, 'Invalid action.');

    await changeOrder(Number(req.params.id), async (conn, order) => {
        // FIX: batil kora order e payment approve/reject korle stock duibar ferot jete pare
        if (order.order_status === 'cancelled') throw fail(400, 'This order is already cancelled.');
        if (order.payment_status !== 'verifying') throw fail(400, 'This payment is not waiting for review.');
        if (action === 'approve') {
            await conn.query(
                "UPDATE orders SET payment_status = 'paid', order_status = 'confirmed' WHERE id = ?",
                [order.id]
            );
        } else {
            await conn.query(
                "UPDATE orders SET payment_status = 'rejected', order_status = 'cancelled' WHERE id = ?",
                [order.id]
            );
            await restoreStock(conn, order.id);
        }
    });
    res.json({ message: action === 'approve' ? 'Payment approved.' : 'Payment rejected.' });
}));

// ---------- customer: nijer order er status ----------
router.get('/code/:code', requireAuth, wrap(async (req, res) => {
    const [rows] = await db.query(
        `SELECT order_code, user_id, total, payment_method, payment_status, order_status
         FROM orders WHERE order_code = ?`,
        [String(req.params.code).toUpperCase()]
    );
    if (!rows.length || (rows[0].user_id !== req.user.id && req.user.role !== 'admin')) {
        throw fail(404, 'Order not found.');
    }
    const { user_id, ...order } = rows[0];
    res.json({ order });
}));

module.exports = router;