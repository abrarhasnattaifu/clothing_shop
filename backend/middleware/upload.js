const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { fail } = require('../utils/helpers');

const dir = path.join(__dirname, '../uploads');
fs.mkdirSync(dir, { recursive: true });

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
    storage: multer.diskStorage({
        destination: dir,
        filename: (req, file, cb) => {
            cb(null, crypto.randomBytes(16).toString('hex') + TYPES[file.mimetype]);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!TYPES[file.mimetype]) {
            cb(fail(400, 'Invalid file type.'));
        } else {
            cb(null, true);
        }
    }
}).fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
    { name: 'side', maxCount: 1 }
]);

module.exports = (req, res, next) => {
    upload(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(fail(400, 'File size exceeds 5MB.'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(fail(400, 'Unexpected file field.'));
        }
        next(err);
    });
};