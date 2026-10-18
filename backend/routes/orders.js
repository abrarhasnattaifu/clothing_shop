const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { fail } = require('../utils/helpers');
const { notifyAdmin, notifyBuyer } = require('../utils/notify');
const { HOLD_MIN } = require('../utils/payConfig');

const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 0);
const METHODS = ['cod', 'bkash', 'rocket'];

router.get('/payment-info', (req, res) => {
    res.json({
        bkash: process.env.BKASH_NUMBER || '',
        rocket: process.env.ROCKET_NUMBER || '',
        delivery_fee: DELIVERY_FEE,
        hold_minutes: HOLD_MIN
    });
});

router.get('/mine', requireAuth, wrap(async (req, res) => {
    const [orders] = await db.query(
        `SELECT id, order_code, total, payment_method, payment_status, order_status, trx_id,
                cancel_requested, cancel_reason, refunded, refund_requested, refund_reason, created_at
         FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
        [req.user.id]
    );
    if (!orders.length) return res.json({ orders: [], hold_minutes: HOLD_MIN });

    const [items] = await db.query(
        'SELECT order_id, product_name, color, size, quantity, unit_price FROM order_items WHERE order_id IN (?)',
        [orders.map((o) => o.id)]
    );
    res.json({
        hold_minutes: HOLD_MIN,
        orders: orders.map((o) => ({
            ...o,
            total: Number(o.total),
            cancel_requested: !!o.cancel_requested,
            refunded: !!o.refunded,
            items: items
                .filter((i) => i.order_id === o.id)
                .map((i) => ({
                    product_name: i.product_name,
                    color: i.color,
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
        'SELECT product_id, color, size, quantity FROM order_items WHERE order_id = ?',
        [orderId]
    );
    for (const it of items) {
        await conn.query(
            `INSERT INTO product_sizes (product_id, color, size, stock) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
            [it.product_id, it.color, it.size, it.quantity]
        );
        await conn.query(
            'UPDATE products SET sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?',
            [it.quantity, it.product_id]
        );
    }
};

const reserveStock = async (conn, orderId) => {
    const [items] = await conn.query(
        'SELECT product_id, color, size, quantity FROM order_items WHERE order_id = ?',
        [orderId]
    );
    for (const item of items) {
        const [result] = await conn.query(
            `UPDATE product_sizes SET stock = stock - ?
             WHERE product_id = ? AND color = ? AND size = ? AND stock >= ?`,
            [item.quantity, item.product_id, item.color, item.size, item.quantity]
        );
        if (!result.affectedRows) {
            throw fail(409, 'There is not enough stock to restore this order. It must remain cancelled.');
        }
        await conn.query(
            'UPDATE products SET sold_count = sold_count + ? WHERE id = ?',
            [item.quantity, item.product_id]
        );
    }
};

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

router.post('/', requireAuth, wrap(async (req, res) => {
    const b = req.body;
    const name = String(b.name || '').trim();
    const phone = String(b.phone || '').replace(/[\s-]/g, '').replace(/^\+?88/, '');
    const address = String(b.address || '').trim();
    const note = String(b.note || '').trim().slice(0, 300);
    const method = String(b.payment_method || '');
    const trxId = String(b.trx_id || '').trim().toUpperCase();
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

        const [cart] = await conn.query(
            'SELECT product_id, color, size, quantity FROM cart_items WHERE user_id = ? AND expires_at > NOW() FOR UPDATE',
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
                'UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND color = ? AND size = ? AND stock >= ?',
                [l.quantity, l.product_id, l.color, l.size, l.quantity]
            );
            if (!u.affectedRows) {
                throw fail(400, `${p[0].name} (${l.color} / ${l.size}) is out of stock or not enough quantity.`);
            }
            await conn.query('UPDATE products SET sold_count = sold_count + ? WHERE id = ?', [l.quantity, l.product_id]);

            const unit = Math.round(Number(p[0].price) * (100 - p[0].discount_percent)) / 100;
            subtotal += unit * l.quantity;
            items.push([l.product_id, p[0].name, l.color, l.size, l.quantity, unit]);
        }
        subtotal = Math.round(subtotal * 100) / 100;
        const total = Math.round((subtotal + DELIVERY_FEE) * 100) / 100;
        const code = await makeCode(conn);

        let payStatus = 'unpaid';
        let orderStatus = 'confirmed';

        if (method !== 'cod') {
            payStatus = 'verifying';
            orderStatus = 'pending';

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
            'INSERT INTO order_items (order_id, product_id, product_name, color, size, quantity, unit_price) VALUES ?',
            [items.map((i) => [r.insertId, ...i])]
        );

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
    notifyBuyer(
        req.user.id,
        result.orderStatus === 'confirmed'
            ? `Your order ${result.code} has been placed and confirmed.`
            : `Your order ${result.code} has been received. Payment is waiting for verification.`,
        result.id
    ).catch((e) => console.error('Buyer notification failed:', e.message));

    res.status(201).json({
        order_code: result.code,
        total: result.total,
        payment_status: result.payStatus,
        order_status: result.orderStatus
    });
}));

router.get('/admin/all', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [orders] = await db.query(
        `SELECT o.*, u.name AS account_name, u.email AS account_email
         FROM orders o JOIN users u ON u.id = o.user_id
         ORDER BY o.id DESC LIMIT 200`
    );
    if (!orders.length) return res.json({ orders: [] });

    const [items] = await db.query(
        'SELECT order_id, product_name, color, size, quantity, unit_price FROM order_items WHERE order_id IN (?)',
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

router.get('/notifications', requireAuth, wrap(async (req, res) => {
    const [list] = await db.query(
        `SELECT id, message, order_id, return_request_id, conversation_id, is_read, created_at
         FROM user_notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
        [req.user.id]
    );
    const [[count]] = await db.query(
        'SELECT COUNT(*) AS n FROM user_notifications WHERE user_id = ? AND is_read = FALSE',
        [req.user.id]
    );
    res.json({ notifications: list, unread: count.n });
}));

router.post('/notifications/read', requireAuth, wrap(async (req, res) => {
    await db.query(
        'UPDATE user_notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
        [req.user.id]
    );
    res.json({ ok: true });
}));

router.patch('/admin/:id/status', requireAuth, requireAdmin, wrap(async (req, res) => {
    const next = String((req.body || {}).order_status || '');
    if (!['confirmed', 'shipped', 'delivered', 'cancelled'].includes(next)) {
        throw fail(400, 'Invalid status.');
    }
    let buyerNotice;
    await changeOrder(Number(req.params.id), async (conn, order) => {
        if (order.order_status === 'cancelled') throw fail(400, 'Cancelled orders cannot be changed.');
        const repairingDeliveryDate =
            next === 'delivered' && order.order_status === 'delivered' && !order.delivered_at;
        if (order.order_status === next && !repairingDeliveryDate) {
            throw fail(400, 'Order already has this status.');
        }

        if (next !== 'cancelled' && order.payment_method !== 'cod' && order.payment_status !== 'paid') {
            throw fail(400, 'Payment is not confirmed yet. Approve the payment first.');
        }

        if (next === 'cancelled') {
            await conn.query(
                `UPDATE orders SET order_status = ?, cancel_requested = FALSE,
                 cancelled_from_status = ? WHERE id = ?`,
                [next, order.order_status, order.id]
            );
            await restoreStock(conn, order.id);
        } else {
            const paidNow = next === 'delivered' && order.payment_method === 'cod';
            await conn.query(
                `UPDATE orders SET order_status = ?, payment_status = ?,
                 delivered_at = IF(? = 'delivered', COALESCE(delivered_at, NOW()), delivered_at),
                 cancelled_from_status = NULL
                 WHERE id = ?`,
                [next, paidNow ? 'paid' : order.payment_status, next, order.id]
            );
        }
        if (!repairingDeliveryDate) {
            buyerNotice = { userId: order.user_id, orderId: order.id, code: order.order_code };
        }
    });
    const statusMessages = {
        confirmed: 'has been confirmed',
        shipped: 'has been shipped',
        delivered: 'has been delivered',
        cancelled: 'has been cancelled'
    };
    if (buyerNotice) {
        notifyBuyer(
            buyerNotice.userId,
            `Your order ${buyerNotice.code} ${statusMessages[next]}.`,
            buyerNotice.orderId
        ).catch((e) => console.error('Buyer notification failed:', e.message));
    }
    res.json({
        message: buyerNotice
            ? 'Status updated.'
            : 'Delivery date recorded. The return window is now available.'
    });
}));

router.patch('/admin/:id/reinstate', requireAuth, requireAdmin, wrap(async (req, res) => {
    const id = Number(req.params.id);
    let buyer;
    await changeOrder(id, async (conn, order) => {
        if (order.order_status !== 'cancelled' || order.refunded) {
            throw fail(400, 'Only a cancelled, not-yet-refunded order can be restored.');
        }
        if (order.payment_status === 'rejected') {
            throw fail(400, 'A rejected payment order cannot be restored.');
        }
        const status = order.cancelled_from_status || 'confirmed';
        await reserveStock(conn, order.id);
        await conn.query(
            `UPDATE orders SET order_status = ?, cancel_requested = FALSE, cancel_reason = NULL,
             cancelled_from_status = NULL, refund_requested = FALSE, refund_reason = NULL
             WHERE id = ?`,
            [status, order.id]
        );
        buyer = { userId: order.user_id, code: order.order_code, orderId: order.id, status };
    });
    notifyBuyer(
        buyer.userId,
        `Your order ${buyer.code} has been restored by the shop and is ${buyer.status}.`,
        buyer.orderId
    ).catch((error) => console.error('Buyer notification failed:', error.message));
    res.json({ message: 'Order restored.' });
}));

router.patch('/admin/:id/payment', requireAuth, requireAdmin, wrap(async (req, res) => {
    const action = String((req.body || {}).action || '');
    if (!['approve', 'reject'].includes(action)) throw fail(400, 'Invalid action.');

    let buyerNotice;
    await changeOrder(Number(req.params.id), async (conn, order) => {
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
        buyerNotice = { userId: order.user_id, orderId: order.id, code: order.order_code };
    });
    notifyBuyer(
        buyerNotice.userId,
        action === 'approve'
            ? `Payment for order ${buyerNotice.code} was approved. Your order is confirmed.`
            : `Payment for order ${buyerNotice.code} was rejected and the order was cancelled.`,
        buyerNotice.orderId
    ).catch((e) => console.error('Buyer notification failed:', e.message));
    res.json({ message: action === 'approve' ? 'Payment approved.' : 'Payment rejected.' });
}));

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

router.post('/:id/cancel', requireAuth, wrap(async (req, res) => {
    const id = Number(req.params.id);
    const reason = String((req.body || {}).reason || '').trim().slice(0, 300);
    let info;

    await changeOrder(id, async (conn, order) => {
        if (order.user_id !== req.user.id) throw fail(404, 'Order not found.');
        if (!['pending', 'confirmed'].includes(order.order_status)) {
            throw fail(400, 'An order can only be cancelled before it is shipped.');
        }
        if (order.payment_status === 'verifying') {
            throw fail(400, 'Your payment is being checked. Please request cancellation review from the shop.');
        }
        if (order.order_status === 'cancelled') throw fail(400, 'This order is already cancelled.');

        const refundRequested = order.payment_status === 'paid' && order.payment_method !== 'cod';
        await restoreStock(conn, order.id);
        await conn.query(
            `UPDATE orders SET order_status = 'cancelled', cancel_requested = FALSE,
             cancel_reason = ?, cancelled_from_status = ?, refund_requested = ?,
             refund_reason = ? WHERE id = ?`,
            [reason || null, order.order_status, refundRequested, refundRequested ? reason || null : null, id]
        );
        info = {
            code: order.order_code,
            total: Number(order.total),
            refundRequested
        };
    });

    const adminMessage = info.refundRequested
        ? `Buyer cancelled order ${info.code} and requested a refund (৳${info.total}).${reason ? ' Reason: ' + reason : ''}`
        : `Buyer cancelled order ${info.code}.${reason ? ' Reason: ' + reason : ''}`;
    notifyAdmin(adminMessage, id)
        .catch((error) => console.error('Admin notification failed:', error.message));
    notifyBuyer(
        req.user.id,
        info.refundRequested
            ? `Order ${info.code} was cancelled. Your refund request has been sent to the shop.`
            : `Order ${info.code} was cancelled successfully.`,
        id
    ).catch((error) => console.error('Buyer notification failed:', error.message));

    res.json({
        message: info.refundRequested
            ? 'Order cancelled. Your refund request has been sent to the shop.'
            : 'Order cancelled.'
    });
}));

router.post('/:id/cancel-request', requireAuth, wrap(async (req, res) => {
    const id = Number(req.params.id);
    const reason = String((req.body || {}).reason || '').trim().slice(0, 300);
    let info;

    await changeOrder(id, async (conn, order) => {
        if (order.user_id !== req.user.id) throw fail(404, 'Order not found.');
        if (order.order_status === 'cancelled') throw fail(400, 'This order is already cancelled.');
        if (order.order_status === 'shipped' || order.order_status === 'delivered') {
            throw fail(400, 'This order is already on its way. Please contact us.');
        }
        if (order.cancel_requested) throw fail(400, 'You already asked to cancel this order.');

        await conn.query(
            'UPDATE orders SET cancel_requested = TRUE, cancel_reason = ? WHERE id = ?',
            [reason || null, id]
        );
        info = { code: order.order_code, total: Number(order.total) };
    });

    notifyAdmin(
        `Cancel requested: order ${info.code} (৳${info.total}).${reason ? ' Reason: ' + reason : ''}`,
        id
    ).catch((e) => console.error('notify failed:', e.message));
    notifyBuyer(
        req.user.id,
        `Your cancellation request for order ${info.code} has been sent to the shop.`,
        id
    ).catch((e) => console.error('Buyer notification failed:', e.message));

    res.json({ message: 'Cancellation requested. The shop will check it and get back to you.' });
}));

router.post('/:id/refund-request', requireAuth, wrap(async (req, res) => {
    const id = Number(req.params.id);
    const reason = String((req.body || {}).reason || '').trim();
    if (reason.length > 300) throw fail(400, 'Refund reason must be 300 characters or fewer.');
    let info;
    await changeOrder(id, async (conn, order) => {
        if (order.user_id !== req.user.id) throw fail(404, 'Order not found.');
        if (order.order_status !== 'cancelled' ||
            !['paid', 'verifying'].includes(order.payment_status) ||
            order.payment_method === 'cod') {
            throw fail(400, 'A refund request is only available for a cancelled order with an online payment.');
        }
        if (order.refunded) throw fail(400, 'This order has already been refunded.');
        if (order.refund_requested) throw fail(400, 'You already requested a refund for this order.');
        await conn.query(
            'UPDATE orders SET refund_requested = TRUE, refund_reason = ? WHERE id = ?',
            [reason || null, id]
        );
        info = { code: order.order_code, total: Number(order.total) };
    });
    notifyAdmin(
        `Refund requested: order ${info.code} (৳${info.total}).${reason ? ' Reason: ' + reason : ''}`,
        id
    ).catch((error) => console.error('Admin notification failed:', error.message));
    notifyBuyer(req.user.id, `Your refund request for order ${info.code} has been sent to the shop.`, id)
        .catch((error) => console.error('Buyer notification failed:', error.message));
    res.status(201).json({ message: 'Refund request sent. The shop will review it.' });
}));

router.patch('/admin/:id/cancel-request', requireAuth, requireAdmin, wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw fail(404, 'Order not found.');

    const [rows] = await db.query(
        'SELECT id, user_id, order_code FROM orders WHERE id = ? AND cancel_requested = TRUE',
        [id]
    );
    if (!rows.length) throw fail(400, 'There is no cancellation request on this order.');
    await db.query('UPDATE orders SET cancel_requested = FALSE WHERE id = ?', [id]);
    notifyBuyer(
        rows[0].user_id,
        `Your cancellation request for order ${rows[0].order_code} was dismissed. The order remains active.`,
        id
    ).catch((e) => console.error('Buyer notification failed:', e.message));
    res.json({ message: 'Request dismissed. The order stays active.' });
}));

router.patch('/admin/:id/refund', requireAuth, requireAdmin, wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw fail(404, 'Order not found.');

    const [r] = await db.query(
        `UPDATE orders SET refunded = TRUE,
         payment_status = IF(payment_status = 'verifying', 'paid', payment_status)
         WHERE id = ? AND order_status = 'cancelled' AND payment_status IN ('paid', 'verifying')
         AND payment_method <> 'cod' AND refunded = FALSE AND refund_requested = TRUE`,
        [id]
    );
    if (!r.affectedRows) throw fail(400, 'Nothing to refund on this order.');
    const [[order]] = await db.query('SELECT user_id, order_code FROM orders WHERE id = ?', [id]);
    notifyBuyer(order.user_id, `Your refund for order ${order.order_code} has been marked as processed.`, id)
        .catch((e) => console.error('Buyer notification failed:', e.message));
    res.json({ message: 'Marked as refunded.' });
}));

module.exports = router;