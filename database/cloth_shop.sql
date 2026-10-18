create database clothing_shop;
create table users (
	id int auto_increment primary key,
    name varchar(100) not null,
    email varchar(100) not null,
    role enum('buyer', 'admin') default 'buyer',
    created_at timestamp default current_timestamp
);

create table login_codes (
	id int auto_increment primary key,
    email varchar(150) not null,
    code_hash char(100) not null,
    expires_at datetime not null,
    attempts int default 0,
    used boolean default false,
    created_at timestamp default current_timestamp,
    index(email)
);
ALTER TABLE users
ADD COLUMN password_hash VARCHAR(255) NULL;

ALTER TABLE login_codes
ADD COLUMN purpose ENUM('login', 'register')
NOT NULL DEFAULT 'login',
ADD COLUMN pending_name VARCHAR(100) NULL,
ADD COLUMN pending_password_hash VARCHAR(255) NULL;


SHOW DATABASES;
USE clothing_shop;
SHOW TABLES;

CREATE DATABASE IF NOT EXISTS clothing_shop;
USE clothing_shop;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    role ENUM('buyer', 'admin') DEFAULT 'buyer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    code_hash CHAR(100) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    used BOOLEAN DEFAULT FALSE,
    purpose ENUM('login', 'register') NOT NULL DEFAULT 'login',
    pending_name VARCHAR(100) NULL,
    pending_password_hash VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (email)
);

SHOW TABLES;


SELECT DATABASE();

SHOW TABLES FROM clothing_shop;

SELECT * FROM clothing_shop.login_codes;
SELECT DATABASE();

SHOW TABLES FROM clothing_shop;

SELECT * FROM clothing_shop.users;
UPDATE users SET role='admin' WHERE email='abrarhansattaifu@gmail.com';

ALTER TABLE users MODIFY email VARCHAR(150) NOT NULL;
ALTER TABLE users ADD UNIQUE (email);

UPDATE users SET role = 'admin' WHERE email = 'abrarhansattaifu@gmail.com';
SELECT email, role FROM users;