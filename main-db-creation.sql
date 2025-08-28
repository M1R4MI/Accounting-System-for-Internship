CREATE DATABASE AccountingSystem;
USE AccountingSystem;

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