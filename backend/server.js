const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const errorHandler = require('./middleware/errorHandler');
const path = require('path');
const app = express();
const cartRouter = require('./routes/cart');
const db = require('./db');
const ordersRouter = require('./routes/orders');
const { expireUnpaidOrders } = require('./utils/expireOrders');
const settingsRouter = require('./routes/settings');
const returnsRouter = require('./routes/returns');
const conversationsRouter = require('./routes/conversations');
const dashboardRouter = require('./routes/dashboard');
const profileRouter = require('./routes/profile');
// Middleware
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/', (req, res) => {
    res.send('Clothing Shop Backend is running!');
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/cart', cartRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
setInterval(() => {
    db.query('DELETE FROM cart_items WHERE expires_at <= NOW()').catch((e) =>
        console.error('Cart cleanup failed:', e.message)
    );
}, 60000);

const sweepOrders = () =>
    expireUnpaidOrders().catch((e) => console.error('Unpaid order cleanup failed:', e.message));
setInterval(sweepOrders, 5 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    sweepOrders();
});