-- Run once on an existing clothing_shop database after the buyer-notification schema is installed.
USE clothing_shop;

ALTER TABLE orders
  ADD COLUMN refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN refund_reason VARCHAR(300) NULL,
  ADD COLUMN cancelled_from_status ENUM('pending','confirmed','shipped','delivered') NULL;

CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('order','product') NOT NULL,
  order_id INT NULL,
  product_id INT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conversation_order_user (order_id, user_id),
  UNIQUE KEY uq_conversation_product_user (product_id, user_id),
  INDEX idx_conversation_user_activity (user_id, created_at),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (
    (type = 'order' AND order_id IS NOT NULL AND product_id IS NULL) OR
    (type = 'product' AND product_id IS NOT NULL AND order_id IS NULL)
  )
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE conversation_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('buyer','admin') NOT NULL,
  message VARCHAR(2000) NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_messages_thread (conversation_id, id),
  INDEX idx_conversation_messages_rate (sender_id, created_at),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) DEFAULT CHARSET = utf8mb4;

ALTER TABLE user_notifications
  ADD COLUMN conversation_id INT NULL,
  ADD INDEX idx_user_notifications_conversation (conversation_id),
  ADD CONSTRAINT fk_user_notifications_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
