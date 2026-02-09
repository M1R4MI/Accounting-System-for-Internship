const mysql = require("mysql2/promise");

async function getDbConnection() {
  const config = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "accounting_user",
    password: process.env.DB_USER_PASSWORD || "App_password_123",
    database: process.env.DB_NAME || "AccountingSystem",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  console.log("Connecting to database:", {
    host: config.host,
    user: config.user,
    database: config.database,
  });

  let retries = 10;
  let pool;

  while (retries > 0) {
    try {
      pool = mysql.createPool(config);
      // Test connection
      const connection = await pool.getConnection();
      connection.release();
      console.log("Successfully connected to database!");
      break;
    } catch (error) {
      console.error(
        `Failed to connect to database (${retries} retries left):`,
        error.message
      );
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }
  }

  return pool;
}

module.exports = getDbConnection;