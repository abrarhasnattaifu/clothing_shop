const db = require('../db');
const { HOLD_MIN } = require('./payConfig');

// bKash/Rocket order e taka verify na hole HOLD_MIN minute por order batil kore stock ferot dey.
// Admin ke kono notification pathay na.
const expireUnpaidOrders = async () => {
    const [stale] = await db.query(
        `SELECT id, order_code FROM orders
         WHERE payment_status = 'verifying' AND order_status <> 'cancelled'
         AND created_at < NOW() - INTERVAL ? MINUTE`,
        [HOLD_MIN]
    );

    for (const o of stale) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // lock kore abar dekhi, ei majhe SMS eshe taka verify hoye gele ar batil korbo na
            const [rows] = await conn.query(
                'SELECT payment_status, order_status FROM orders WHERE id = ? FOR UPDATE',
                [o.id]
            );
            if (rows.length && rows[0].payment_status === 'verifying' && rows[0].order_status !== 'cancelled') {
                const [items] = await conn.query(
                    'SELECT product_id, size, quantity FROM order_items WHERE order_id = ?',
                    [o.id]
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
                await conn.query(
                    "UPDATE orders SET order_status = 'cancelled', payment_status = 'rejected' WHERE id = ?",
                    [o.id]
                );
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            console.error(`Could not expire order ${o.order_code}:`, err.message);
        } finally {
            conn.release();
        }
    }
};

module.exports = { expireUnpaidOrders };