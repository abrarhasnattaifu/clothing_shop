const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const errorHandler = require('./middleware/errorHandler');
const path = require('path');
const app = express();
// Middleware
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/', (req, res) => {
    res.send('Clothing Shop Backend is running!');
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});