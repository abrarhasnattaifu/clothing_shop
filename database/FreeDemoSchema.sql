CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  address VARCHAR(500) NULL,
  profile_image VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL,
  role ENUM('buyer', 'admin') NOT NULL DEFAULT 'buyer',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE login_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  code_hash CHAR(100) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  purpose ENUM('login', 'register') NOT NULL DEFAULT 'register',
  pending_name VARCHAR(100) NULL,
  pending_password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_codes_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  audience VARCHAR(20) NOT NULL DEFAULT 'uncategorized',
  product_type VARCHAR(20) NOT NULL DEFAULT 'other',
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  image_front VARCHAR(255) NOT NULL,
  image_back VARCHAR(255) NULL,
  image_side VARCHAR(255) NULL,
  sold_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  color VARCHAR(40) NOT NULL DEFAULT 'Default',
  size VARCHAR(10) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_color_size (product_id, color, size),
  CONSTRAINT fk_product_sizes_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL,
  user_id INT NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(500) NOT NULL,
  note VARCHAR(300) NULL,
  payment_method ENUM('cod', 'bkash', 'rocket') NOT NULL,
  trx_id VARCHAR(40) NULL,
  pay_number VARCHAR(20) NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_status ENUM('unpaid', 'verifying', 'paid', 'rejected') NOT NULL DEFAULT 'unpaid',
  order_status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_reason VARCHAR(300) NULL,
  refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
  refund_reason VARCHAR(300) NULL,
  refunded BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_from_status ENUM('pending', 'confirmed', 'shipped', 'delivered') NULL,
  delivered_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_code (order_code),
  UNIQUE KEY uq_order_trx (trx_id),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_pay (payment_status, order_status, created_at),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  color VARCHAR(40) NOT NULL DEFAULT 'Default',
  size VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  INDEX idx_cart_expires_at (expires_at),
  CONSTRAINT fk_cart_items_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE return_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(20) NOT NULL UNIQUE,
  order_id INT NOT NULL,
  order_item_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('return') NOT NULL DEFAULT 'return',
  quantity INT NOT NULL,
  problem VARCHAR(30) NOT NULL,
  details VARCHAR(500) NOT NULL,
  reason VARCHAR(300) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
  admin_note VARCHAR(300) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_return_requests_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_return_requests_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_return_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('order', 'product', 'general') NOT NULL,
  order_id INT NULL,
  product_id INT NULL,
  user_id INT NOT NULL,
  general_key VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conversation_order_user (order_id, user_id),
  UNIQUE KEY uq_conversation_product_user (product_id, user_id),
  UNIQUE KEY uq_conversations_general_key (general_key),
  INDEX idx_conversation_user_activity (user_id, created_at),
  CONSTRAINT fk_conversations_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_conversations_resource CHECK (
    (type = 'order' AND order_id IS NOT NULL AND product_id IS NULL AND general_key IS NULL)
    OR (type = 'product' AND product_id IS NOT NULL AND order_id IS NULL AND general_key IS NULL)
    OR (type = 'general' AND order_id IS NULL AND product_id IS NULL AND general_key IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversation_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('buyer', 'admin') NOT NULL,
  message VARCHAR(2000) NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_messages_thread (conversation_id, id),
  INDEX idx_conversation_messages_rate (sender_id, created_at),
  CONSTRAINT fk_conversation_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message VARCHAR(400) NOT NULL,
  order_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(400) NOT NULL,
  order_id INT NULL,
  return_request_id INT NULL,
  conversation_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_notifications_unread (user_id, is_read, id),
  INDEX idx_user_notifications_conversation (conversation_id),
  CONSTRAINT fk_user_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_notifications_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_notifications_return
    FOREIGN KEY (return_request_id) REFERENCES return_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_notifications_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
