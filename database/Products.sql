USE clothing_shop;

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  audience VARCHAR(20) NOT NULL DEFAULT 'uncategorized',
  product_type VARCHAR(20) NOT NULL DEFAULT 'other',
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  image_front VARCHAR(255) NOT NULL,
  image_back VARCHAR(255) NULL,
  image_side VARCHAR(255) NULL,
  sold_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  color VARCHAR(40) NOT NULL DEFAULT 'Default',
  size VARCHAR(10) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_color_size (product_id, color, size),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

USE clothing_shop;

CREATE TABLE cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  color VARCHAR(40) NOT NULL DEFAULT 'Default',
  size VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  expires_at DATETIME NOT NULL,
  extended BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_cart_product_color_size (user_id, product_id, color, size),
  INDEX (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);


USE clothing_shop;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL,
  user_id INT NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(500) NOT NULL,
  note VARCHAR(300) NULL,
  payment_method ENUM('cod','bkash','rocket') NOT NULL,
  trx_id VARCHAR(40) NULL,
  pay_number VARCHAR(20) NULL,             
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_status ENUM('unpaid','verifying','paid','rejected') NOT NULL DEFAULT 'unpaid',
  order_status ENUM('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
  refund_reason VARCHAR(300) NULL,
  cancelled_from_status ENUM('pending','confirmed','shipped','delivered') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_code (order_code),
  UNIQUE KEY uq_order_trx (trx_id),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_pay (payment_status, order_status, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  color VARCHAR(40) NOT NULL DEFAULT 'Default',
  size VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS payment_sms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  method VARCHAR(20) NOT NULL,
  trx_id VARCHAR(40) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  from_number VARCHAR(20) NULL,              
  sender VARCHAR(30) NULL,
  raw_text VARCHAR(500) NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sms_trx (trx_id)         
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message VARCHAR(400) NOT NULL,
  order_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET = utf8mb4;

ALTER TABLE orders      ADD COLUMN pay_number  VARCHAR(20) NULL AFTER trx_id;
ALTER TABLE payment_sms ADD COLUMN from_number VARCHAR(20) NULL AFTER amount;

USE clothing_shop;

ALTER TABLE orders
  ADD COLUMN cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN cancel_reason VARCHAR(300) NULL,
  ADD COLUMN refunded BOOLEAN NOT NULL DEFAULT FALSE;

DROP TABLE IF EXISTS payment_sms;

USE clothing_shop;

CREATE TABLE site_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL DEFAULT ''
);

USE clothing_shop;

ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL;
UPDATE orders SET delivered_at = created_at WHERE order_status = 'delivered' AND delivered_at IS NULL;

CREATE TABLE return_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(20) NOT NULL UNIQUE,
  order_id INT NOT NULL,
  order_item_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('return') NOT NULL,
  quantity INT NOT NULL,
  problem VARCHAR(30) NOT NULL,
  details VARCHAR(500) NOT NULL,
  reason VARCHAR(300) NOT NULL,
  status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  admin_note VARCHAR(300) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

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

CREATE TABLE IF NOT EXISTS user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(400) NOT NULL,
  order_id INT NULL,
  return_request_id INT NULL,
  conversation_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_notifications_unread (user_id, is_read, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (return_request_id) REFERENCES return_requests(id) ON DELETE CASCADE,
  INDEX idx_user_notifications_conversation (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) DEFAULT CHARSET = utf8mb4;