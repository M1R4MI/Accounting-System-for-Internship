CREATE DATABASE AccountingSystem;
USE AccountingSystem;

CREATE TABLE year2025(
	ID INT auto_increment primary key,
    registrationNumber varchar(30),
    name varchar(255),
    studentGroup varchar(30),
    registrationDate DATE,
    information varchar(500),
    contact varchar(255),
    documentType varchar(30),
    signingStatus varchar(30),
    op varchar(30)
);