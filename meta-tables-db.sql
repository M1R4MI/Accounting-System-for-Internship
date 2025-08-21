CREATE TABLE tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  faculty VARCHAR(255) NOT NULL,
  speciality_code VARCHAR(50) NOT NULL,
  department VARCHAR(255) NOT NULL,
  groups_count INT NOT NULL,
  year INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

