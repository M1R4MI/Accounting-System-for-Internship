const mysql = require('mysql2/promise');

async function getDbConnection(){
   return await mysql.createConnection({
      host: 'localhost',
      user:'root',
      password:'mainRoot',
      database:'AccountingSystem',
      waitForConnections: true
   });
}

module.exports = getDbConnection;