const express = require('express');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { fail } = require('../utils/helpers');
const { notifyAdmin, notifyBuyer } = require('../utils/notify');

const messageLimit = 2000;

const loadConversation = async (id, user) => {
    const [rows] = await db.query(
        `SELECT c.id, c.type, c.order_id, c.product_id, c.user_id,
                o.order_code, p.name AS product_name
         FROM conversations c
         LEFT JOIN orders o ON o.id = c.order_id
         LEFT JOIN products p ON p.id = c.product_id
         WHERE c.id = ?`,
        [id]
    );
    if (!rows.length || (user.role !== 'admin' && rows[0].user_id !== user.id)) {
        throw fail(404, 'Conversation not found.');
    }
    return rows[0];
};

const openConversation = async (type, resourceId, user) => {
    if (user.role === 'admin') throw fail(403, 'Admins cannot start buyer conversations.');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let sql;
        let params;
        if (type === 'order') {
            [sql, params] = [
                `INSERT INTO conversations (type, order_id, user_id)
                 SELECT 'order', orders.id, ? FROM orders WHERE orders.id = ? AND orders.user_id = ?
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(conversations.id)`,
                [user.id, resourceId, user.id]
            ];
        } else {
            [sql, params] = [
                `INSERT INTO conversations (type, product_id, user_id)
                 SELECT 'product', products.id, ? FROM products WHERE products.id = ? AND products.is_active = TRUE
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(conversations.id)`,
                [user.id, resourceId, user.id]
            ];
        }
        await conn.query(sql, params);
        const resourceColumn = type === 'order' ? 'order_id' : 'product_id';
        const [rows] = await conn.query(
            `SELECT id FROM conversations WHERE ${resourceColumn} = ? AND user_id = ?`,
            [resourceId, user.id]
        );
        if (!rows.length) throw fail(404, `${type === 'order' ? 'Order' : 'Product'} not found.`);
        await conn.commit();
        return rows[0].id;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

router.get('/mine', requireAuth, wrap(async (req, res) => {
    if (req.user.role === 'admin') throw fail(403, 'Use the admin conversation inbox.');
    const [conversations] = await db.query(
        `SELECT c.id, c.type, c.order_id, c.product_id, c.created_at,
                o.order_code, p.name AS product_name,
                (SELECT m.message FROM conversation_messages m
                 WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT m.created_at FROM conversation_messages m
                 WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
                (SELECT COUNT(*) FROM conversation_messages m
                 WHERE m.conversation_id = c.id AND m.sender_role = 'admin' AND m.read_at IS NULL) AS unread
         FROM conversations c
         LEFT JOIN orders o ON o.id = c.order_id
         LEFT JOIN products p ON p.id = c.product_id
         WHERE c.user_id = ? ORDER BY COALESCE(last_message_at, c.created_at) DESC LIMIT 100`,
        [req.user.id]
    );
    res.json({ conversations });
}));

router.post('/order/:id', requireAuth, wrap(async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) throw fail(404, 'Order not found.');
    const id = await openConversation('order', orderId, req.user);
    res.status(201).json({ conversation_id: id });
}));

router.post('/admin/order/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) throw fail(404, 'Order not found.');
    await db.query(
        `INSERT INTO conversations (type, order_id, user_id)
         SELECT 'order', orders.id, orders.user_id FROM orders WHERE orders.id = ?
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(conversations.id)`,
        [orderId]
    );
    const [rows] = await db.query('SELECT id FROM conversations WHERE order_id = ?', [orderId]);
    if (!rows.length) throw fail(404, 'Order not found.');
    res.status(201).json({ conversation_id: rows[0].id });
}));

router.post('/product/:id', requireAuth, wrap(async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isSafeInteger(productId) || productId < 1) throw fail(404, 'Product not found.');
    const id = await openConversation('product', productId, req.user);
    res.status(201).json({ conversation_id: id });
}));

router.post('/general', requireAuth, wrap(async (req, res) => {
    if (req.user.role === 'admin') throw fail(403, 'Only buyers can start a general conversation.');
    await db.query(
        `INSERT INTO conversations (type, user_id, general_key) VALUES ('general', ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [req.user.id, `buyer:${req.user.id}`]
    );
    const [rows] = await db.query(
        `SELECT id FROM conversations
         WHERE type = 'general' AND user_id = ? ORDER BY id DESC LIMIT 1`,
        [req.user.id]
    );
    if (!rows.length) throw fail(500, 'Could not open the conversation.');
    res.status(201).json({ conversation_id: rows[0].id });
}));

router.get('/admin/all', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [conversations] = await db.query(
        `SELECT c.id, c.type, c.order_id, c.product_id, c.user_id, c.created_at,
                u.name AS buyer_name, u.email AS buyer_email,
                o.order_code, p.name AS product_name,
                (SELECT m.message FROM conversation_messages m
                 WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT m.created_at FROM conversation_messages m
                 WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
                (SELECT COUNT(*) FROM conversation_messages m
                 WHERE m.conversation_id = c.id AND m.sender_role = 'buyer' AND m.read_at IS NULL) AS unread
         FROM conversations c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN orders o ON o.id = c.order_id
         LEFT JOIN products p ON p.id = c.product_id
         ORDER BY COALESCE(last_message_at, c.created_at) DESC LIMIT 200`
    );
    res.json({ conversations });
}));

router.get('/:id/messages', requireAuth, wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw fail(404, 'Conversation not found.');
    const conversation = await loadConversation(id, req.user);
    await db.query(
        `UPDATE conversation_messages SET read_at = NOW()
         WHERE conversation_id = ? AND sender_role <> ? AND read_at IS NULL`,
        [id, req.user.role]
    );
    const [messages] = await db.query(
        `SELECT m.id, m.sender_id, m.sender_role, u.name AS sender_name, m.message, m.created_at
         FROM conversation_messages m JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ? ORDER BY m.id ASC LIMIT 500`,
        [id]
    );
    res.json({ conversation, messages });
}));

router.post('/:id/messages', requireAuth, wrap(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!Number.isSafeInteger(id) || id < 1) throw fail(404, 'Conversation not found.');
    if (!message || message.length > messageLimit) {
        throw fail(400, `Message must be between 1 and ${messageLimit} characters.`);
    }

    const conn = await db.getConnection();
    let conversation;
    let insertedId;
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
        const [rate] = await conn.query(
            `SELECT COUNT(*) AS total FROM conversation_messages
             WHERE sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [req.user.id]
        );
        if (Number(rate[0].total) >= 10) throw fail(429, 'Please wait a moment before sending another message.');
        const [rows] = await conn.query(
            `SELECT c.id, c.type, c.order_id, c.product_id, c.user_id,
                    o.order_code, p.name AS product_name
             FROM conversations c
             LEFT JOIN orders o ON o.id = c.order_id
             LEFT JOIN products p ON p.id = c.product_id
             WHERE c.id = ? FOR UPDATE`,
            [id]
        );
        if (!rows.length || (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)) {
            throw fail(404, 'Conversation not found.');
        }
        conversation = rows[0];
        const [result] = await conn.query(
            `INSERT INTO conversation_messages (conversation_id, sender_id, sender_role, message)
             VALUES (?, ?, ?, ?)`,
            [id, req.user.id, req.user.role, message]
        );
        insertedId = result.insertId;
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }

    const topic = conversation.type === 'order'
        ? `order ${conversation.order_code}`
        : conversation.type === 'product'
            ? `product ${conversation.product_name}`
            : 'your conversation with the shop';
    const notice = `New message about ${topic}.`;
    const notify = req.user.role === 'admin'
        ? notifyBuyer(conversation.user_id, notice, conversation.order_id, null, id)
        : notifyAdmin(`${notice} Conversation #${id}`, conversation.order_id);
    notify.catch((error) => console.error('Conversation notification failed:', error.message));

    const [messages] = await db.query(
        `SELECT m.id, m.sender_id, m.sender_role, u.name AS sender_name, m.message, m.created_at
         FROM conversation_messages m JOIN users u ON u.id = m.sender_id
         WHERE m.id = ?`,
        [insertedId]
    );
    res.status(201).json({ message: messages[0] });
}));

module.exports = router;
