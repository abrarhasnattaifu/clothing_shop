ALTER TABLE users
    ADD COLUMN phone VARCHAR(20) NULL AFTER email,
    ADD COLUMN address VARCHAR(500) NULL AFTER phone,
    ADD COLUMN profile_image VARCHAR(255) NULL AFTER address;

ALTER TABLE conversations
    DROP CHECK conversations_chk_1,
    MODIFY COLUMN type ENUM('order', 'product', 'general') NOT NULL,
    ADD COLUMN general_key VARCHAR(32) NULL,
    ADD UNIQUE KEY uq_conversations_general_key (general_key),
    ADD CONSTRAINT chk_conversations_resource CHECK (
        (type = 'order' AND order_id IS NOT NULL AND product_id IS NULL AND general_key IS NULL)
        OR (type = 'product' AND product_id IS NOT NULL AND order_id IS NULL AND general_key IS NULL)
        OR (type = 'general' AND order_id IS NULL AND product_id IS NULL AND general_key IS NOT NULL)
    );
