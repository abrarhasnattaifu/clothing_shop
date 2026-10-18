require('dotenv').config();
const HOLD_MIN = Number(process.env.PAYMENT_HOLD_MINUTES) || 60;

module.exports = { HOLD_MIN };