USE clothing_shop;

ALTER TABLE return_requests
  MODIFY COLUMN type ENUM('return') NOT NULL,
  DROP COLUMN exchange_size;
