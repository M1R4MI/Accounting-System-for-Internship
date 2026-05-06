-- Allow root and app user from any host
ALTER USER 'root'@'%' IDENTIFIED BY 'Master123';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- Create app user for AccountingSystem database  
CREATE USER IF NOT EXISTS 'accounting_user'@'%' IDENTIFIED BY 'App_password_123';
GRANT ALL PRIVILEGES ON AccountingSystem.* TO 'accounting_user'@'%';
FLUSH PRIVILEGES;

-- Створення бази даних
CREATE DATABASE IF NOT EXISTS AccountingSystem CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE AccountingSystem;

-- ==========================================
-- СТАТИЧНІ ТАБЛИЦІ (Автентифікація та Студенти)
-- ==========================================

-- 1. Таблиця користувачів (Викладачі, Студенти, Адміністратори)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблиця груп
CREATE TABLE IF NOT EXISTS student_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL UNIQUE
);

-- 3. Студенти (База для імпорту з Excel)
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL, 
    group_id INT NOT NULL,
    record_book_number VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE RESTRICT
);

-- ==========================================
-- ДИНАМІЧНА ЧАСТИНА ("Таблиця Таблиць")
-- ==========================================

-- 4. Реєстр таблиць практики (Головна таблиця для викладача)
-- Зберігає інформацію про всі динамічно створені таблиці
CREATE TABLE IF NOT EXISTS meta_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NULL, -- Зв'язок з користувачем, який створив таблицю
    tableName VARCHAR(255) NOT NULL,
    faculty VARCHAR(255),
    speciality_code VARCHAR(50),
    department VARCHAR(255),
    groups_count INT,
    entry_year INT,
    created_at varchar(32) NOT NULL,
    updated_at varchar(32) NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- 5. Файли та звіти
-- Оскільки файли не можна зберігати в динамічних таблицях, робимо універсальну таблицю
CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    registry_id INT NOT NULL, -- Прив'язка до конкретної практики з реєстру
    document_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (registry_id) REFERENCES practice_tables_registry(id) ON DELETE CASCADE
);