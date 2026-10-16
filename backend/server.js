const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRouter = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.send('Clothing Shop Backend is running!');
});

app.use('/api/auth', authRouter);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});