const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const wrap = require('../middleware/wrap');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { fail } = require('../utils/helpers');
const upload = require('../middleware/upload');
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const urlOf = (file) => `/uploads/${file.filename}`;

const removeFiles = (files) => {
    
    Object.values(files || {}).flat().forEach((f) => fs.unlink(f.path, () => {}));
   
};

const removeUpload = (urlPath) => {
    if (urlPath) fs.unlink(path.join(__dirname, '..', urlPath), () => {});
};


const readFields = (body) => {
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const price = Math.round(Number(body.price) * 100) / 100;
    const discount = Number(body.discount_percent || 0);
 
    let sizes;
    try {
        sizes = JSON.parse(body.sizes || '[]');
    } catch {
        throw fail(400, 'Invalid sizes.');
    }
 
    if (!name || name.length > 150) {
        throw fail(400, 'Enter a product name (max 150 characters).');
    }
    if (description.length > 2000) {
        throw fail(400, 'Description is too long (max 2000 characters).');
    }
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
        throw fail(400, 'Enter a valid price.');
    }
    if (!Number.isInteger(discount) || discount < 0 || discount > 90) {
        throw fail(400, 'Discount must be a whole number from 0 to 90.');
    }
    if (!Array.isArray(sizes) || !sizes.length) {
        throw fail(400, 'Add stock for at least one size.');
    }
 
    const seen = new Set();
    sizes = sizes.map((s) => {
        const size = String(s.size || '').trim().toUpperCase();
        const stock = Number(s.stock);
        if (!SIZES.includes(size) || seen.has(size)) {
            throw fail(400, 'Invalid or repeated size.');
        }
        if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
            throw fail(400, 'Stock must be a whole number (0 or more).');
        }
        seen.add(size);
        return { size, stock };
    });
 
    return { name, description, price, discount, sizes };
};
const attachSizes = async (products, hold = false) => {
    if (!products.length) return [];
    const ids = products.map((p) => p.id);

    const [sizeRows] = await db.query(
        'SELECT product_id, size, stock FROM product_sizes WHERE product_id IN (?) ORDER BY id',
        [ids]
    );

    // public pej e onner hold kora stock bad jabe, admin e asol stock
    let heldRows = [];
    if (hold) {
        [heldRows] = await db.query(
            `SELECT product_id, size, SUM(quantity) AS held FROM cart_items
             WHERE expires_at > NOW() AND product_id IN (?) GROUP BY product_id, size`,
            [ids]
        );
    }
    const held = (pid, size) =>
        Number(heldRows.find((h) => h.product_id === pid && h.size === size)?.held || 0);

    return products.map((p) => {
        const sizes = sizeRows
            .filter((s) => s.product_id === p.id)
            .map((s) => ({ size: s.size, stock: Math.max(s.stock - held(p.id, s.size), 0) }));

        return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: Number(p.price),
            discount_percent: p.discount_percent,
            final_price: Math.round(Number(p.price) * (100 - p.discount_percent)) / 100,
            image_front: p.image_front,
            image_back: p.image_back,
            image_side: p.image_side,
            sold_count: p.sold_count,
            is_active: !!p.is_active,
            sizes,
            total_stock: sizes.reduce((sum, s) => sum + s.stock, 0)
        };
    });
};
// ---------- public routes ----------
 
router.get('/', wrap(async (req, res) => {
    const [rows] = await db.query(
        'SELECT * FROM products WHERE is_active = TRUE ORDER BY id DESC'
    );
    res.json({ products: await attachSizes(rows, true) });
}));
 
// FIX: frontend (adminProducts.jsx) /admin/all dake. hidden product o dekhate hobe, jate abar visible kora jay
router.get('/admin/all', requireAuth, requireAdmin, wrap(async (req, res) => {
    const [rows] = await db.query('SELECT * FROM products ORDER BY id DESC');
    res.json({ products: await attachSizes(rows) });
}));
 
router.get('/:id', wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw fail(404, 'Product not found.');
 
    const [rows] = await db.query(
        'SELECT * FROM products WHERE id = ? AND is_active = TRUE',
        [id]
    );
    if (!rows.length) throw fail(404, 'Product not found.');
 
    const [product] = await attachSizes(rows, true);
    res.json({ product });
}));
 
// ---------- admin routes ----------

router.post('/', requireAuth, requireAdmin, upload, wrap(async (req, res) => {
    const files = req.files || {};
    try {
        const f = readFields(req.body);
        if (!files.front) throw fail(400, 'Front image is required.');
 
        const conn = await db.getConnection();
        let productId;
        try {
            await conn.beginTransaction();
            const [result] = await conn.query(
                `INSERT INTO products
                 (name, description, price, discount_percent, image_front, image_back, image_side)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    f.name, f.description, f.price, f.discount,
                    urlOf(files.front[0]),
                    files.back ? urlOf(files.back[0]) : null,
                    files.side ? urlOf(files.side[0]) : null
                ]
            );
            productId = result.insertId;
            await conn.query(
                'INSERT INTO product_sizes (product_id, size, stock) VALUES ?',
                [f.sizes.map((s) => [productId, s.size, s.stock])]
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
 
        res.status(201).json({ message: 'Product added.', id: productId });
    } catch (err) {
        removeFiles(files); 
        throw err;
    }
}));
 
router.put('/:id', requireAuth, requireAdmin, upload, wrap(async (req, res) => {
    const files = req.files || {};
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) throw fail(404, 'Product not found.');
 
        const f = readFields(req.body);
        const isActive = req.body.is_active === 'true' || req.body.is_active === true;
 
        const [rows] = await db.query(
            'SELECT image_front, image_back, image_side FROM products WHERE id = ?',
            [id]
        );
        if (!rows.length) throw fail(404, 'Product not found.');
        const old = rows[0];
 
        const next = {
            image_front: files.front ? urlOf(files.front[0]) : old.image_front,
            image_back: files.back ? urlOf(files.back[0]) : old.image_back,
            image_side: files.side ? urlOf(files.side[0]) : old.image_side
        };
 
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `UPDATE products
                 SET name = ?, description = ?, price = ?, discount_percent = ?, is_active = ?,
                     image_front = ?, image_back = ?, image_side = ?
                 WHERE id = ?`,
                [
                    f.name, f.description, f.price, f.discount, isActive,
                    next.image_front, next.image_back, next.image_side, id
                ]
            );
            await conn.query(
                'DELETE FROM product_sizes WHERE product_id = ? AND size NOT IN (?)',
                [id, f.sizes.map((s) => s.size)]
            );
            await conn.query(
                `INSERT INTO product_sizes (product_id, size, stock) VALUES ?
                 ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
                [f.sizes.map((s) => [id, s.size, s.stock])]
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
        if (files.front) removeUpload(old.image_front);
        if (files.back) removeUpload(old.image_back);
        if (files.side) removeUpload(old.image_side);
 
        res.json({ message: 'Product updated.' });
    } catch (err) {
        removeFiles(files);
        throw err;
    }
}));
 
module.exports = router;