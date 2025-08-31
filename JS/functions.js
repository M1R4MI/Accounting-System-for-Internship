async function generateRegistrationNumber(tableName,departmentID, connection) {
  let d = new Date();
  let year = d.getFullYear().toString().substr(-2);

  const [rows] = await connection.execute(
    `SELECT RegistrationNumber
         FROM ${tableName}
         WHERE RegistrationNumber LIKE ?
         ORDER BY id DESC LIMIT 1`,
    [`${departmentID}.%:%`]
  );

  let nextSerial = 1;

  if (rows.length > 0) {
    const lastReg = rows[0].RegistrationNumber;
    const match = lastReg.match(/\.(\d+):/);
    if (match) {
      nextSerial = parseInt(match[1], 10) + 1;
    }
  }

  const paddedSerial = nextSerial.toString().padStart(2, "0");
  const newRegistrationNumber = `${departmentID}.${paddedSerial}:${year}`;

  return newRegistrationNumber;
}

async function searchInTable(tableName,input, connection) {
  try {
    const [result] = await connection.query(
      `SELECT * FROM ${tableName}
             WHERE StudentName LIKE ? OR RegistrationNumber LIKE ?`,
      [`%${input}%`, `%${input}%`]
    );
    return [result];
  } catch (err) {
    console.error("Error while searching:", err);
    throw new Error("Database query failed");
  }
}

function detectColumnType(values) {
  let isInt = true;
  let isFloat = true;
  let isDate = true;

  for (let val of values) {
    if (val === null || val === undefined || val === "") continue;

    if (!Number.isInteger(Number(val))) isInt = false;
    if (isNaN(Number(val))) {
      isInt = false;
      isFloat = false;
    }

    if (!(val instanceof Date) && isNaN(Date.parse(val))) isDate = false;
  }

  if (isInt) return "INT";
  if (isFloat) return "DECIMAL(10,2)";
  if (isDate) return "DATE";
  return "VARCHAR(255)";
}

// функція для безпечного формування назви таблиці
function safeTableName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("Некоректна назва таблиці");
  }
}

function getDateTime() {
  const date = new Date();
  const formattedDate = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date).toString();
  return formattedDate;
}

module.exports = {
  generateRegistrationNumber,
  searchInTable,
  detectColumnType,
  safeTableName,
  getDateTime,
};
