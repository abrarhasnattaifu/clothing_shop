USE clothing_shop;

CREATE TABLE IF NOT EXISTS user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(400) NOT NULL,
  order_id INT NULL,
  return_request_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_notifications_unread (user_id, is_read, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (return_request_id) REFERENCES return_requests(id) ON DELETE CASCADE
) DEFAULT CHARSET = utf8mb4;

UPDATE site_settings
SET setting_value = 'Returns within 3 days'
WHERE setting_key = 'return_note'
  AND LOWER(setting_value) LIKE '%exchange%';
