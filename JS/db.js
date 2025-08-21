const mysql = require("mysql2/promise");

async function createDatabaseIfNotExists(connectionConfig) {
  const { host, user, password, database, waitForConnections } =
    connectionConfig;

  let connection;
  try {
    // Connect to the MySQL server (without specifying a database initially)
    connection = await mysql.createConnection({
      host,
      user,
      password,
      waitForConnections,
    });

    // Execute the CREATE DATABASE IF NOT EXISTS query
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.log(`Database '${database}' ensured to exist.`);
  } catch (error) {
    console.error("Error creating database:", error);
    throw error; // Re-throw the error for external handling
  } finally {
    if (connection) {
      await connection.end(); // Close the connection
    }
  }
}

async function getDbConnection() {
  const config = {
    host: "localhost",
    user: "root",
    password: "mainRoot",
    database: "AccountingSystem",
    waitForConnections: true,
  };
  return createDatabaseIfNotExists(config);
}

module.exports = getDbConnection;
