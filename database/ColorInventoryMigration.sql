ALTER TABLE product_sizes
    ADD COLUMN color VARCHAR(40) NOT NULL DEFAULT 'Default' AFTER product_id,
    DROP INDEX product_id,
    ADD UNIQUE KEY uq_product_color_size (product_id, color, size);

ALTER TABLE cart_items
    ADD COLUMN color VARCHAR(40) NOT NULL DEFAULT 'Default' AFTER product_id,
    DROP INDEX user_id,
    ADD UNIQUE KEY uq_cart_product_color_size (user_id, product_id, color, size);

ALTER TABLE order_items
    ADD COLUMN color VARCHAR(40) NOT NULL DEFAULT 'Default' AFTER product_name;
