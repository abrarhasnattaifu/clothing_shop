ALTER TABLE products
    ADD COLUMN audience VARCHAR(20) NOT NULL DEFAULT 'uncategorized' AFTER name,
    ADD COLUMN product_type VARCHAR(20) NOT NULL DEFAULT 'other' AFTER audience;
