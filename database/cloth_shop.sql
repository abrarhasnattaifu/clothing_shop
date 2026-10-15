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