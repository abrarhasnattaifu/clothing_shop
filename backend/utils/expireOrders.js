const db = require('../db');
const { notifyBuyer } = require('./notify');
const { HOLD_MIN } = require('./payConfig');

const expireUnpaidOrders = async () => {
    const [stale] = await db.query(
        `SELECT id, user_id, order_code FROM orders
         WHERE payment_status = 'verifying' AND order_status <> 'cancelled'
         AND created_at < NOW() - INTERVAL ? MINUTE`,
        [HOLD_MIN]
    );

    for (const o of stale) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query(
                'SELECT payment_status, order_status FROM orders WHERE id = ? FOR UPDATE',
                [o.id]
            );
            let expired = false;
            if (rows.length && rows[0].payment_status === 'verifying' && rows[0].order_status !== 'cancelled') {
                const [items] = await conn.query(
                    'SELECT product_id, color, size, quantity FROM order_items WHERE order_id = ?',
                    [o.id]
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
                await conn.query(
                    "UPDATE orders SET order_status = 'cancelled', payment_status = 'rejected' WHERE id = ?",
                    [o.id]
                );
                expired = true;
            }
            await conn.commit();
            if (expired) {
                notifyBuyer(
                    o.user_id,
                    `Order ${o.order_code} was cancelled because payment was not verified in time.`,
                    o.id
                ).catch((e) => console.error('Buyer notification failed:', e.message));
            }
        } catch (err) {
            await conn.rollback();
            console.error(`Could not expire order ${o.order_code}:`, err.message);
        } finally {
            conn.release();
        }
    }
};

module.exports = { expireUnpaidOrders };