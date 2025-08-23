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

