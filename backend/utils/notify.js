const db = require('../db'); 
const sendEmail = require('./sendEmail');

const notifyAdmin = async (message, orderId = null) => {
    await db.query('INSERT INTO notifications (message, order_id) VALUES (?, ?)', [message, orderId]);

    if (process.env.ADMIN_EMAIL) {
        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: 'MamaCloset: ' + message,
            text: message
        })
            .catch((e) => console.error('Admin email failed:', e.message));
    }
};

const notifyBuyer = async (userId, message, orderId = null, returnRequestId = null, conversationId = null) => {
    await db.query(
        `INSERT INTO user_notifications (user_id, message, order_id, return_request_id, conversation_id)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, message, orderId, returnRequestId, conversationId]
    );
};

module.exports = { notifyAdmin, notifyBuyer };