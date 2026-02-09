-- Allow root and app user from any host
ALTER USER 'root'@'%' IDENTIFIED BY 'Master123';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- Create database
CREATE DATABASE IF NOT EXISTS AccountingSystem;
USE AccountingSystem;

-- Create app user for AccountingSystem database  
CREATE USER IF NOT EXISTS 'accounting_user'@'%' IDENTIFIED BY 'App_password_123';
GRANT ALL PRIVILEGES ON AccountingSystem.* TO 'accounting_user'@'%';
FLUSH PRIVILEGES;

CREATE TABLE year2025(
	ID INT auto_increment primary key,
    RegistrationNumber varchar(30),
    StudentName varchar(255),
    StudentGroup varchar(30),
    RegistrationDate DATE,
    Information varchar(500),
    Contact varchar(255),
    DocumentType varchar(30),
    SigningStatus varchar(30),
    OccupationalSafety varchar(30)
);

CREATE TABLE meta_tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tableName VARCHAR(255) NOT NULL,
  faculty VARCHAR(255),
  speciality_code VARCHAR(50),
  department VARCHAR(255),
  groups_count INT,
  entry_year INT,
  created_at varchar(32) NOT NULL,
  updated_at varchar(32) NOT NULL
);
