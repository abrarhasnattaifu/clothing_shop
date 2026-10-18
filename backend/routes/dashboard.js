const express = require('express');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/buyer', requireAuth, wrap(async (req, res) => {
    if (req.user.role === 'admin') {
        return res.status(403).json({ error: 'Buyer dashboard is not available to admins.' });
    }

    const [[summary]] = await db.query(
        `SELECT COUNT(*) AS total_orders,
                SUM(order_status IN ('pending','confirmed','shipped')) AS pending_orders,
                SUM(order_status = 'delivered') AS completed_orders,
                COALESCE(SUM(
                    CASE WHEN payment_status = 'paid' AND order_status <> 'cancelled' AND refunded = FALSE
                    THEN total ELSE 0 END
                ), 0) AS total_spending
         FROM orders WHERE user_id = ?`,
        [req.user.id]
    );
    const [recentOrders] = await db.query(
        `SELECT order_code, total, payment_status, order_status, created_at
         FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 5`,
        [req.user.id]
    );
    const [statusRows] = await db.query(
        `SELECT order_status, COUNT(*) AS total
         FROM orders WHERE user_id = ? GROUP BY order_status`,
        [req.user.id]
    );
    const [products] = await db.query(
        `SELECT p.id, p.name, p.price, p.discount_percent, p.image_front, p.sold_count,
                COALESCE(SUM(ps.stock), 0) AS total_stock
         FROM products p
         LEFT JOIN product_sizes ps ON ps.product_id = p.id
         WHERE p.is_active = TRUE
         GROUP BY p.id
         ORDER BY p.sold_count DESC, p.id DESC LIMIT 4`
    );

    res.json({
        summary: {
            total_orders: Number(summary.total_orders || 0),
            pending_orders: Number(summary.pending_orders || 0),
            completed_orders: Number(summary.completed_orders || 0),
            total_spending: Number(summary.total_spending || 0)
        },
        recent_orders: recentOrders.map((order) => ({ ...order, total: Number(order.total) })),
        order_status: statusRows.reduce((result, row) => {
            result[row.order_status] = Number(row.total);
            return result;
        }, {}),
        products: products.map((product) => ({
            ...product,
            price: Number(product.price),
            discount_percent: Number(product.discount_percent),
            final_price: Math.round(Number(product.price) * (100 - Number(product.discount_percent))) / 100,
            total_stock: Number(product.total_stock)
        }))
    });
}));

router.get('/admin', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [[summary]] = await db.query(
        `SELECT
            (SELECT COALESCE(SUM(total), 0) FROM orders
             WHERE payment_status = 'paid' AND order_status <> 'cancelled' AND refunded = FALSE) AS total_sales,
            (SELECT COALESCE(SUM(total), 0) FROM orders
             WHERE order_status <> 'cancelled') AS total_order_amount,
            (SELECT COUNT(*) FROM orders) AS total_orders,
            (SELECT COUNT(*) FROM products) AS total_products,
            (SELECT COUNT(*) FROM users WHERE role = 'buyer') AS total_customers,
            (SELECT COUNT(*) FROM orders WHERE order_status = 'pending') AS pending_orders,
            (SELECT COUNT(*) FROM (
                SELECT p.id
                FROM products p
                LEFT JOIN product_sizes ps ON ps.product_id = p.id
                WHERE p.is_active = TRUE
                GROUP BY p.id
                HAVING COALESCE(SUM(ps.stock), 0) <= 5
            ) AS low_stock) AS low_stock_products`
    );
    const [recentOrders] = await db.query(
        `SELECT id, order_code, customer_name, total, payment_method, payment_status, order_status, created_at
         FROM orders ORDER BY id DESC LIMIT 5`
    );
    const [recentActivities] = await db.query(
        `SELECT id, message, order_id, created_at
         FROM notifications ORDER BY id DESC LIMIT 8`
    );
    const [lowStock] = await db.query(
        `SELECT p.id, p.name, COALESCE(SUM(ps.stock), 0) AS total_stock
         FROM products p
         LEFT JOIN product_sizes ps ON ps.product_id = p.id
         WHERE p.is_active = TRUE
         GROUP BY p.id, p.name
         HAVING COALESCE(SUM(ps.stock), 0) <= 5
         ORDER BY total_stock ASC, p.name ASC LIMIT 8`
    );

    res.json({
        summary: Object.fromEntries(
            Object.entries(summary).map(([key, value]) => [key, Number(value || 0)])
        ),
        recent_orders: recentOrders.map((order) => ({ ...order, total: Number(order.total) })),
        recent_activities: recentActivities,
        low_stock: lowStock.map((product) => ({ ...product, total_stock: Number(product.total_stock) }))
    });
}));

module.exports = router;
