const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const wrap = require('../middleware/wrap');
const { fail } = require('../utils/helpers');
const { parseSms } = require('../utils/sms');
const { notifyAdmin } = require('../utils/notify');
const { HOLD_MIN } = require('../utils/payConfig');

const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

// database a SMS rakhar age balance lukiye dei
const redact = (text) =>
    String(text)
        .replace(/Balance[:\s]*(?:Tk\.?|BDT|৳)?\s*[\d,]+(?:\.\d+)?/gi, 'Balance [hidden]')
        .slice(0, 500);

router.post('/sms', wrap(async (req, res) => {
    const secret = String(req.headers['x-webhook-secret'] || '');
    const expected = String(process.env.SMS_WEBHOOK_SECRET || '');
    const ok =
        expected &&
        secret.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
    if (!ok) {
        console.log('[sms] rejected: wrong or missing x-webhook-secret header');
        throw fail(401, 'Unauthorized.');
    }

    // alada alada SMS app alada naam pathay, tai kayekta naam-i dekhi
    const sender = req.body.from || req.body.sender || req.body.address || req.body.number || '';
    const text = req.body.text || req.body.message || req.body.body || req.body.sms || '';

    const sms = parseSms(sender, text);
    if (!sms) {
        console.log(`[sms] ignored: not a payment SMS (sender: "${String(sender).slice(0, 30)}")`);
        return res.json({ ignored: true }); // onno SMS, kichu save hobe na
    }

    let note = null;
    let orderId = null;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        try {
            await conn.query(
                'INSERT INTO payment_sms (method, trx_id, amount, from_number, sender, raw_text) VALUES (?, ?, ?, ?, ?, ?)',
                [sms.method, sms.trxId, sms.amount, sms.fromNumber, String(sender).slice(0, 30), redact(text)]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                await conn.rollback();
                return res.json({ duplicate: true });
            }
            throw err;
        }

        const [orders] = await conn.query(
            `SELECT id, order_code, total, pay_number FROM orders
             WHERE trx_id = ? AND payment_method = ? AND payment_status = 'verifying'
             AND order_status <> 'cancelled'
             AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) <= ?
             FOR UPDATE`,
            [sms.trxId, sms.method, HOLD_MIN]
        );

        if (orders.length) {
            const o = orders[0];
            orderId = o.id;
            // SMS e number thakle order e customer er deya number er shathe milte hobe
            const numberOk = !sms.fromNumber || !o.pay_number || sms.fromNumber === o.pay_number;

            if (sameAmount(o.total, sms.amount) && numberOk) {
                await conn.query(
                    "UPDATE orders SET payment_status = 'paid', order_status = 'confirmed' WHERE id = ?",
                    [o.id]
                );
                await conn.query('UPDATE payment_sms SET used = TRUE WHERE trx_id = ?', [sms.trxId]);
                note = `Payment verified: order ${o.order_code}, ৳${sms.amount}`;
            } else if (!sameAmount(o.total, sms.amount)) {
                note = `Amount mismatch on order ${o.order_code}: paid ৳${sms.amount}, expected ৳${o.total}`;
            } else {
                note = `Number mismatch on order ${o.order_code}: payment came from ${sms.fromNumber}, customer entered ${o.pay_number}`;
            }
        }

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    console.log(`[sms] ${sms.method} TrxID ${sms.trxId} ৳${sms.amount} -> ${note || 'saved, no waiting order with this TrxID yet'}`);

    // FIX: payment ager-i save hoye gechhe. notification fail hole 500 diye SMS app ke bhul khobor dewa jabe na
    if (note) {
        try {
            await notifyAdmin(note, orderId);
        } catch (e) {
            console.error('notify failed:', e.message);
        }
    }
    res.json({ ok: true });
}));

module.exports = router;