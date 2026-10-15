const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRouter = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');
const app = express();
const router = express.Router();
// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use(errorHandler);
app.get('/', (req, res) => {
    res.send('Clothing Shop Backend is running!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});