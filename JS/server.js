const getDbConnection = require("./db.js");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const auxiliary = require("./functions.js");
const dateFormat = require("dayjs");
const ExcelJs = require("exceljs");
const multer = require("multer");
const dateTime = auxiliary.getDateTime();

const app = express();
const upload = multer({ dest: "uploads/" });
(async () => {
  try {
    const db = await getDbConnection();
    console.log("Connected to db!");
    const PORT = process.env.PORT || 3308;
    app.listen(PORT, () => {
      console.log(`Server running on port: ${PORT}`);
    });

    app.use(cors());
    app.use(bodyParser.json());
    app.use(express.static("../public"));
    app.use(express.static("../public/html"));
    app.use("/css", express.static("../public/css"));
    app.use("/JS", express.static(__dirname));

    // Endpoint: отримати метадані таблиці по id
    app.get("/api/meta_tables/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const [rows] = await db.query(
          "SELECT * FROM meta_tables WHERE id = ?",
          [id]
        );
        if (!rows.length)
          return res.status(404).json({ error: "Таблицю не знайдено" });
        res.json(rows[0]);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Endpoint: оновити метадані таблиці по id
    app.put("/api/meta_tables/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const {
          tableName,
          faculty,
          speciality_code,
          department,
          groups_count,
          entry_year,
        } = req.body;
        if (!tableName)
          return res.status(400).json({ error: "Введіть назву таблиці" });
        const [result] = await db.query(
          `UPDATE meta_tables SET tableName=?, faculty=?, speciality_code=?, department=?, groups_count=?, entry_year=?, updated_at=? WHERE id=?`,
          [
            tableName,
            faculty,
            speciality_code,
            department,
            groups_count,
            entry_year,
            dateTime,
            id,
          ]
        );
        if (result.affectedRows === 0)
          return res.status(404).json({ error: "Таблицю не знайдено" });
        res.json({ message: "Дані таблиці оновлено" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "../public", "html", "index.html"));
    });

    const [dbRows] = await db.query(
      `
           CREATE TABLE IF NOT EXISTS meta_tables (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tableName VARCHAR(255) NOT NULL,
                faculty VARCHAR(255),
                speciality_code VARCHAR(50),
                department VARCHAR(255),
                groups_count INT,
                entry_year INT,
                created_at varchar(32) NOT NULL,
                updated_at varchar(32) NOT NULL
            );`
    );

    app.get("/api/meta_tables", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await getDataWithPagination("meta_tables", page, limit);
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка при завантаженні даних" });
      }
    });

    app.post("/create-table", async (req, res) => {
      try {
        const {
          tableName,
          faculty,
          speciality_code,
          department,
          groups_count,
          entry_year,
        } = req.body;

        if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
          return res.status(400).json({ error: "Неправильна назва таблиці" });
        }

        const createTableSql = `
          CREATE TABLE IF NOT EXISTS \`${tableName}\`(
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
        `;
        await db.query(createTableSql);

        const insertMetaSql = `
          INSERT INTO meta_tables (tableName, faculty, speciality_code, department, groups_count, entry_year, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.query(insertMetaSql, [
          tableName,
          faculty,
          speciality_code,
          department,
          groups_count,
          entry_year,
          dateTime,
          dateTime,
        ]);

        res.json({ message: `Таблиця ${tableName} створена` });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get("api/:table", async (req, res) => {
      try {
        const { table } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await getDataWithPagination(table, page, limit);
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка при завантаженні даних" });
      }
    });

    app.post("/upload", upload.single("file"), async (req, res) => {
      try {
        const workbook = new ExcelJs.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const worksheet = workbook.worksheets[0];
        const sheetName = worksheet.name;
        const tableName = sheetName.toLowerCase().replace(/\s+/g, "_");

        //Getting headers
        const headerRow = worksheet.getRow(1);
        const keys = headerRow.values.slice(1).map((v) => v.toString().trim());

        if (!keys.length) {
          return res.json({ message: "Файл порожній або без заголовків" });
        }

        //Getting all the data from excel table
        const sheet = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData = {};
          keys.forEach((k, i) => {
            rowData[k] = row.values[i + 1];
          });
          sheet.push(rowData);
        });

        if (sheet.length === 0) {
          return res.json({ message: "Файл не містить даних" });
        }

        //Getting column types
        const columnTypes = {};
        for (let key of keys) {
          const colValues = sheet.map((row) => row[key]);
          columnTypes[key] = auxiliary.detectColumnType(colValues);
        }

        //Create table if not exists
        let createQuery = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ${keys.map((k) => `\`${k}\` ${columnTypes[k]}`).join(", ")});`;

        await db.query(createQuery);

        const insertMetaSql = `
          INSERT INTO meta_tables (tableName, created_at, updated_at)
          VALUES (?, ?, ?)`;

        await db.query(insertMetaSql, [tableName, dateTime, dateTime]);
        // Add unique key for all the columns
        let uniqueKey = `ALTER TABLE \`${tableName}\` ADD UNIQUE KEY unique_row (${keys
          .map((c) => `\`${c}\``)
          .join(", ")});`;

        try {
          await db.query(uniqueKey);
        } catch {
          // якщо ключ вже існує — ігноруємо
        }

        // 🔹 Вставка даних без дублікатів
        for (let row of sheet) {
          let cols = Object.keys(row);
          let values = cols.map((col) => row[col]);
          let placeholders = cols.map(() => "?").join(",");

          let insertQuery = `INSERT IGNORE INTO \`${tableName}\` (${cols
            .map((c) => `\`${c}\``)
            .join(",")}) VALUES (${placeholders})`;

          await db.query(insertQuery, values);
        }

        res.json({
          message: `Таблиця '${tableName}' оновлена: нові рядки додано, дублікати пропущено`,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Помилка при обробці файлу" });
      }
    });

    app.get("/table", async (req, res) => {
      try {
        const [rows] = await db.query("SELECT * FROM year2025");
        const formattedRows = rows.map((row) => ({
          ...row,
          registrationDate: dateFormat(row.registrationDate).format(
            "DD-MM-YYYY"
          ),
        }));
        res.json(formattedRows);
      } catch (err) {
        res.status(500).json(err);
      }
    });

    //-- Method to add data into the table with generation of registration number --
    // This method is used to add a new row to the table with a generated registration number
    app.post("/table", async (req, res) => {
      try {
        const {
          name,
          registrationDate,
          information,
          contact,
          studentGroup,
          documentType,
          signingStatus,
          op,
        } = req.body;

        if (!name) {
          return res
            .status(400)
            .json({ error: "Missing required field: name" });
        }

        const registrationNumber = await auxiliary.generateRegistrationNumber(
          "08-32",
          db
        );
        const [result] = await db.query("INSERT INTO year2025 SET ?", {
          name,
          registrationNumber,
          registrationDate,
          information,
          contact,
          studentGroup,
          documentType,
          signingStatus,
          op,
        });
        res.json({ id: result.insertId });
      } catch (err) {
        console.error("Error in POST /table:", err);
        res
          .status(500)
          .json({ error: "Internal Server Error", details: err.message });
      }
    });

    app.get("/table/search/:input", async (req, res) => {
      const input = req.params.input;
      if (!input) {
        return res
          .status(400)
          .json({ error: "Missing required query parameter: input" });
      }
      try {
        const [results] = await auxiliary.searchInTable(input, db);
        const formattedResults = results.map((row) => ({
          ...row,
          registrationDate: dateFormat(row.registrationDate).format(
            "DD-MM-YYYY"
          ),
        }));
        res.json(formattedResults);
      } catch (err) {
        console.error("Error in GET /table/search:", err);
        res
          .status(500)
          .json({ error: "Internal Server Error", details: err.message });
      }
    });

    app.get("/table/sort/", async (req, res) => {
      const sortBy = req.query.by || "name";
      const order = req.query.order === "asc" ? "ASC" : "DESC";
      const allowedFields = ["name", "registrationDate", "studentGroup"];

      try {
        if (!allowedFields.includes(sortBy)) {
          res.status(400).send("Invalid sort field");
        }
        const [results] = await db.query(
          `SELECT * FROM year2025 ORDER BY ${sortBy} ${order}`
        );
        const formattedResults = results.map((row) => ({
          ...row,
          registrationDate: dateFormat(row.registrationDate).format(
            "DD-MM-YYYY"
          ),
        }));
        res.json(formattedResults);
      } catch (err) {
        res
          .status(500)
          .json({ error: "Cannot sort table by name", details: err.message });
      }
    });

    app.get("/table/export", async (req, res) => {
      const table = req.query.table;

      if (!table) {
        return res.status(400).send("Table name is required");
      }

      try {
        const [rows] = await db.query(`SELECT * FROM year2025`);

        const workbook = new ExcelJs.Workbook();
        const worksheet = workbook.addWorksheet(table);

        if (rows.length > 0) {
          //Add column header
          worksheet.columns = Object.keys(rows[0]).map((key) => ({
            header: key,
            key: key,
            width: 20,
          }));

          rows.forEach((row) => worksheet.addRow(row));
        }

        res.setHeader(
          "Content-Type",
          "application/wnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Description",
          `attachment; filename=${table}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
      } catch (err) {
        console.error("Error exporting table to Excel: ", err);
        res.status(500).send("Internal server error");
      }
    });

    //--HTTP clone row in table method--
    app.post("/table/clone/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const [rows] = await db.query("SELECT * FROM year2025 WHERE id = ?", [
          id,
        ]);
        if (rows.length === 0) {
          return res.status(404).json({ error: "Row not found" });
        }
        const row = rows[0];

        const [results] = await db.query(
          "INSERT INTO year2025(name, registrationNumber, registrationDate, information, contact, studentGroup, documentType, signingStatus, op) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            row.name,
            row.registrationNumber,
            row.registrationDate,
            row.information,
            row.contact,
            row.studentGroup,
            row.documentType,
            row.signingStatus,
            row.op,
          ]
        );

        res.json({ id: results.insertId });
      } catch (err) {
        res.status(500).json(err);
      }
    });

    //--HTTP edit row in table method--
    app.put("/table/:id", async (req, res) => {
      const {
        name,
        registrationDate,
        information,
        contact,
        studentGroup,
        documentType,
        signingStatus,
        op,
      } = req.body;
      try {
        await db.query(
          "UPDATE year2025 SET name = ?, registrationDate = ?, information = ?, contact = ?, studentGroup = ?, documentType = ?, signingStatus = ?, op = ? WHERE id = ?",
          [
            name,
            registrationDate,
            information,
            contact,
            studentGroup,
            documentType,
            signingStatus,
            op,
            req.params.id,
          ]
        );

        res.json({ message: "Row updated successfully" });
      } catch (err) {
        res.status(500).json(err);
      }
    });

    //--HTTP delete row in table method--
    app.delete("/table/:id", async (req, res) => {
      try {
        db.query(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id]);
        res.sendStatus(200);
      } catch (err) {
        res.status(500).json(err);
      }
    });

    //HTTP query to delete element from meta_tables table
    app.delete("/api/meta_tables/:id", async (req, res) => {
      const tableName = "meta_tables";
      try {
        // Ім'я таблиці підставляємо напряму, id — через плейсхолдер
        await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [
          req.params.id,
        ]);
        res.sendStatus(200);
      } catch (err) {
        res.status(500).json(err);
      }
    });

    async function getDataWithPagination(tableName, page = 1, limit = 10) {
      const offset = (page - 1) * limit;

      // basic whitelist to avoid SQL injection for identifiers
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw new Error("Invalid table name");
      }

      const tableId = `\`${tableName}\``;
      let rows = [];
      if (tableName === "meta_tables") {
        const [r] = await db.query(
          `SELECT id, tableName AS name, faculty, speciality_code, created_at, updated_at FROM ${tableId} LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        rows = r;
      } else {
        const [r] = await db.query(
          `SELECT * FROM ${tableId} LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        rows = r;
      }

      const [countRows] = await db.query(
        `SELECT COUNT(*) AS total FROM ${tableId}`
      );

      const total = (countRows && countRows[0] && countRows[0].total) || 0;

      return {
        data: rows,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }
  } catch (err) {
    console.error("Failed to start server: ", err);
  }
})();
