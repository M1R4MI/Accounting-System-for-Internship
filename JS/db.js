const mysql = require("mysql2/promise");

async function createDatabaseIfNotExists(connectionConfig) {
  const { host, user, password, database, waitForConnections } =
    connectionConfig;

  let connection;
  try {
  connection = await mysql.createConnection({ host, user, password });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
  console.log(`Database '${database}' ensured to exist.`);
  } catch (error) {
    console.error("Error creating database:", error);
    throw error; // Re-throw the error for external handling
  } finally {
    if (connection) {
      await connection.end();
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
  await createDatabaseIfNotExists(config);
  const pool = mysql.createPool(config);
  return pool;
}

module.exports = getDbConnection;