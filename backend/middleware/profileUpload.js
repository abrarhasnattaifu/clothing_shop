const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { fail } = require('../utils/helpers');

const dir = path.join(__dirname, '../uploads');
fs.mkdirSync(dir, { recursive: true });

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, `profile-${crypto.randomBytes(16).toString('hex')}${TYPES[file.mimetype]}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!TYPES[file.mimetype]) return cb(fail(400, 'Profile photo must be JPG, PNG, or WEBP.'));
        cb(null, true);
    }
}).single('profile_image');

module.exports = (req, res, next) => {
    upload(req, res, async (error) => {
        if (error) {
            if (error.code === 'LIMIT_FILE_SIZE') return next(fail(400, 'Profile photo must be 3 MB or smaller.'));
            if (error.code === 'LIMIT_UNEXPECTED_FILE') return next(fail(400, 'Unexpected profile photo field.'));
            return next(error);
        }
        if (!req.file) return next();

        let handle;
        try {
            handle = await fs.promises.open(req.file.path, 'r');
            const header = Buffer.alloc(12);
            const { bytesRead } = await handle.read(header, 0, header.length, 0);
            const jpeg = bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
            const png = bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            const webp = bytesRead >= 12 && header.toString('ascii', 0, 4) === 'RIFF'
                && header.toString('ascii', 8, 12) === 'WEBP';
            if (jpeg || png || webp) {
                await handle.close();
                handle = null;
                return next();
            }
            await handle.close();
            handle = null;
            await fs.promises.unlink(req.file.path);
            return next(fail(400, 'The uploaded file is not a valid JPG, PNG, or WEBP image.'));
        } catch (verificationError) {
            if (handle) await handle.close().catch((closeError) =>
                console.error('Could not close profile photo:', closeError.message)
            );
            await fs.promises.unlink(req.file.path).catch((cleanupError) => {
                if (cleanupError.code !== 'ENOENT') console.error('Invalid profile photo cleanup failed:', cleanupError.message);
            });
            next(verificationError);
        }
    });
};
