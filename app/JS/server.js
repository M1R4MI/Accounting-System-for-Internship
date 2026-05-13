const getDbConnection = require("./db.js");
const bodyParser = require("body-parser");
const auxiliary = require("./functions.js");
const dateFormat = require("dayjs");
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const { error } = require("console");
const dateTime = auxiliary.getDateTime();

const app = express();
const upload = multer({
    dest: path.join(__dirname, "uploads/"),
    limits: {fileSize: 10 * 1024 * 1024} //10 MB
 });

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_internship_key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if(!token) return res.status(401).json({error: "Доступ заборонено (відсутній токен)"});

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if(err) return res.status(401).json({error: "Недійсний або прострочений токен. Увійдіть знову."});
    req.user = user;
    next();
  });
};

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
    app.use(express.static("./public"));
    app.use(express.static("./public/html"));
    app.use("/css", express.static("./public/css"));
    app.use("/JS", express.static(__dirname));
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

       // 1. Користувачі
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('student', 'teacher', 'admin') DEFAULT 'teacher',
        full_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Мета-таблиці (ОНОВЛЕНО: додано teacher_id)
    await db.query(`
      CREATE TABLE IF NOT EXISTS meta_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NULL, -- Зв'язок з користувачем, який створив таблицю
        tableName VARCHAR(255) NOT NULL,
        faculty VARCHAR(255),
        speciality_code VARCHAR(50),
        department VARCHAR(255),
        groups_count INT,
        entry_year INT,
        created_at varchar(32) NOT NULL,
        updated_at varchar(32) NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Інші таблиці (Словник, Файли)
    await db.query(`
      CREATE TABLE IF NOT EXISTS students_dictionary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        record_book_number VARCHAR(50) UNIQUE,
        group_name VARCHAR(50) NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        row_id INT NOT NULL,
        document_type VARCHAR(50) DEFAULT 'other',
        file_path VARCHAR(500) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    //Автентифікація
    app.post('/api/auth/register', async (req, res) => {
        const { email, password, full_name, role } = req.body;
        if (!email || !password || !full_name) return res.status(400).json({ error: 'Заповніть всі обов\'язкові поля' });
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
                [email, hashedPassword, full_name, role || 'teacher']
            );
            res.status(201).json({ message: 'Реєстрація успішна' });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Цей email вже зареєстрований' });
            res.status(500).json({ error: 'Помилка сервера' });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            if (users.length === 0) return res.status(401).json({ error: 'Невірні дані' });
            const user = users[0];
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) return res.status(401).json({ error: 'Невірні дані' });
            const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, role: user.role, full_name: user.full_name });
        } catch (error) {
            console.error("ДЕТАЛІ ПОМИЛКИ ЛОГІНУ:", error); // Виведе в термінал
            res.status(500).json({ error: `Деталі: ${error.message}` });
        }
    });

        // Отримати список таблиць (тільки свої або всі для адміна)
    app.get("/api/meta_tables", authenticateToken, async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        let queryStr = `SELECT id, tableName, descriptionField AS name, faculty, speciality_code, created_at, updated_at FROM meta_tables`;
        let countQueryStr = `SELECT COUNT(*) AS total FROM meta_tables`;
        let queryParams = [];

        // Якщо це звичайний викладач, показуємо тільки його таблиці
        if (req.user.role !== 'admin') {
            queryStr += ` WHERE teacher_id = ?`;
            countQueryStr += ` WHERE teacher_id = ?`;
            queryParams.push(req.user.id);
        }

        queryStr += ` LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);

        const [rows] = await db.query(queryStr, queryParams);
        const [countRows] = await db.query(countQueryStr, req.user.role !== 'admin' ? [req.user.id] : []);

        const total = (countRows && countRows[0] && countRows[0].total) || 0;

        res.json({
            data: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка при завантаженні даних" });
      }
    });

      // Отримати метадані однієї таблиці
    app.get("/api/meta_tables/:id", authenticateToken, async (req, res) => {
      try {
        const [rows] = await db.query("SELECT * FROM meta_tables WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Таблицю не знайдено" });
        
        // Перевірка доступу
        if (rows[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Доступ заборонено" });
        }
        res.json(rows[0]);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Створення нової таблиці (з прив'язкою до викладача)
    app.post("/create-table", authenticateToken, async (req, res) => {
      try {
        const { tableName, descriptionField, faculty, speciality_code, department, groups_count, entry_year } = req.body; // Залишаємо тільки назву і опис
        const teacherId = req.user.id;

        if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
          return res.status(400).json({ error: "Неправильна назва таблиці" });
        }

        // ОНОВЛЕНА СТРУКТУРА ДИНАМІЧНОЇ ТАБЛИЦІ
        const createTableSql = `
          CREATE TABLE IF NOT EXISTS \`${tableName}\`(
            ID INT auto_increment primary key,
            student_id INT NOT NULL,
            RegistrationNumber varchar(30),
            RegistrationDate DATE,
            Information varchar(500),
            Contact varchar(255),
            DocumentType varchar(30),
            SigningStatus varchar(30),
            OccupationalSafety varchar(30),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
          );
        `;
        await db.query(createTableSql);

        const insertMetaSql = `
          INSERT INTO meta_tables (teacher_id, tableName, descriptionField, faculty, speciality_code, department, groups_count, entry_year, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.query(insertMetaSql, [teacherId, tableName, descriptionField, faculty, speciality_code, department, groups_count, entry_year, dateTime, dateTime]);

        res.json({ message: `Таблиця ${tableName} створена` });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Оновлення таблиці
    app.put("/api/meta_tables/:id", authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { tableName, descriptionField, faculty, speciality_code, department, groups_count, entry_year } = req.body;
        if (!tableName) return res.status(400).json({ error: "Введіть назву таблиці" });

        // Перевіряємо стару таблицю і права доступу
        const [oldRows] = await db.query("SELECT tableName, teacher_id FROM meta_tables WHERE id = ?", [id]);
        if (!oldRows.length) return res.status(404).json({ error: "Таблицю не знайдено" });

        const ownerId = oldRows[0].teacherId;
        const userId = req.user.id;
        
        if(ownerId != null && ownerId != userId && req.user.role !== 'admin') {
          return res.status(403).json({error: "Доступ заборонено."});
        }

        const oldTableName = oldRows[0].tableName;

        if (oldTableName !== tableName) {
          if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return res.status(400).json({ error: "Неправильна нова назва таблиці" });
          await db.query(`ALTER TABLE \`${oldTableName}\` RENAME TO \`${tableName}\``);
        }

        await db.query(
          `UPDATE meta_tables SET tableName=?, descriptionField=?, faculty=?, speciality_code=?, department=?, groups_count=?, entry_year=?, updated_at=? WHERE id=?`,
          [tableName, descriptionField, faculty, speciality_code, department, groups_count, entry_year, dateTime, id]
        );
        res.json({ message: "Дані таблиці оновлено" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Видалення таблиці
    app.delete("/api/meta_tables/:id", authenticateToken, async (req, res) => {
      try {
        // 1. Отримуємо дані про таблицю з БД (змінна називається table, а не oldRows)
        const [table] = await db.query("SELECT teacher_id, tableName FROM meta_tables WHERE id = ?", [req.params.id]);
        
        if (!table.length) {
            return res.status(404).json({ error: "Таблицю не знайдено" });
        }

        // Зчитуємо дані таблиці та користувача
        const ownerId = table[0].teacher_id;
        const tableName = table[0].tableName;
        
        const userId = req.user.id;
        const userRole = req.user.role;

        // 2. Надійна перевірка прав
        if (ownerId != null && ownerId != userId && userRole !== 'admin') {
            return res.status(403).json({ error: "Доступ заборонено. Це не ваша таблиця." });
        }

        // 3. Видаляємо фізичну таблицю з бази даних, якщо в неї є ім'я
        if (tableName && tableName.trim() !== '') {
            try {
                await db.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            } catch (dropErr) {
                console.error("Не вдалося видалити фізичну таблицю:", dropErr);
                // Продовжуємо навіть якщо фізичної таблиці немає
            }
        }

        // 4. Видаляємо запис з реєстру (meta_tables)
        await db.query(`DELETE FROM meta_tables WHERE id = ?`, [req.params.id]);
        
        // Відправляємо успішний результат
        res.json({ message: "Успішно видалено" });
      } catch (err) {
        console.error("Помилка сервера при видаленні:", err);
        res.status(500).json({ error: err.message || "Внутрішня помилка сервера" });
      }
    });

        // Створення таблиці через завантаження Excel (ОНОВЛЕНО: додано teacher_id)
    app.post("/upload", authenticateToken, upload.single("file"), async (req, res) => {
      try {
        const teacherId = req.user.id; // Отримуємо ID викладача з токена

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const worksheet = workbook.worksheets[0];
        const sheetName = worksheet.name;
        const tableName = sheetName.toLowerCase().replace(/\s+/g, "_");

        const headerRow = worksheet.getRow(1);
        const keys = headerRow.values.slice(1).map((v) => v.toString().trim());

        if (!keys.length) return res.json({ message: "Файл порожній або без заголовків" });

        const sheet = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData = {};
          keys.forEach((k, i) => { rowData[k] = row.values[i + 1]; });
          sheet.push(rowData);
        });

        if (sheet.length === 0) return res.json({ message: "Файл не містить даних" });

        const columnTypes = {};
        for (let key of keys) {
          const colValues = sheet.map((row) => row[key]);
          columnTypes[key] = auxiliary.detectColumnType(colValues);
        }

        let createQuery = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ${keys.map((k) => `\`${k}\` ${columnTypes[k]}`).join(", ")});`;

        await db.query(createQuery);

        // Додаємо teacher_id при записі в meta_tables
        const insertMetaSql = `
          INSERT INTO meta_tables (teacher_id, tableName, created_at, updated_at)
          VALUES (?, ?, ?, ?)`;

        await db.query(insertMetaSql, [teacherId, tableName, dateTime, dateTime]);
        
        let uniqueKey = `ALTER TABLE \`${tableName}\` ADD UNIQUE KEY unique_row (${keys.map((c) => `\`${c}\``).join(", ")});`;
        try { await db.query(uniqueKey); } catch {}

        for (let row of sheet) {
          let cols = Object.keys(row);
          let values = cols.map((col) => row[col]);
          let placeholders = cols.map(() => "?").join(",");
          let insertQuery = `INSERT IGNORE INTO \`${tableName}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${placeholders})`;
          await db.query(insertQuery, values);
        }

        fs.unlinkSync(req.file.path);
        res.json({ message: `Таблиця '${tableName}' оновлена/створена з Excel` });
      } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error(err);
        res.status(500).json({ message: "Помилка при обробці файлу" });
      }
    });

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "../public", "html", "index.html"));
    });

    // Віддавати HTML сторінку таблиці за /table
    app.get("/table", (req, res) => {
      res.sendFile(path.join(__dirname, "../public", "html", "table.html"));
    });

    app.post('/api/students/import-dictionary', authenticateToken, upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Файл не знайдено' });
        try {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            // Зчитуємо дані. defval: "" запобігає втраті порожніх комірок
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
            
            if (data.length === 0) {
                 fs.unlinkSync(req.file.path);
                 return res.status(400).json({ error: "Файл порожній або дані відсутні." });
            }

            // Динамічний пошук колонок (ігнорує пробіли та регістр)
            const keys = Object.keys(data[0]);
            const pibKey = keys.find(k => k.toLowerCase().includes('піб') || k.toLowerCase().includes('п.і.б') || k.toLowerCase().includes('імя'));
            const groupKey = keys.find(k => k.toLowerCase().includes('груп'));
            const bookKey = keys.find(k => k.toLowerCase().includes('залік'));

            if (!pibKey || !groupKey) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: "Не знайдено обов'язкові колонки (ПІБ, Група). Перевірте заголовки в файлі." });
            }

            let studentsAdded = 0;
            let groupsAdded = 0;

            for (const row of data) {
                const fullName = row[pibKey] ? String(row[pibKey]).trim() : null;
                const groupName = row[groupKey] ? String(row[groupKey]).trim() : null;
                const recordBook = bookKey && row[bookKey] ? String(row[bookKey]).trim() : null;

                if (fullName && groupName) {
                    // 1. Знаходимо або створюємо групу
                    let groupId;
                    const [existingGroup] = await db.query('SELECT id FROM student_groups WHERE group_name = ?', [groupName]);
                    
                    if (existingGroup.length > 0) {
                        groupId = existingGroup[0].id;
                    } else {
                        const [newGroupResult] = await db.query('INSERT INTO student_groups (group_name) VALUES (?)', [groupName]);
                        groupId = newGroupResult.insertId;
                        groupsAdded++;
                    }

                    // 2. Додаємо студента
                    const [studentResult] = await db.query(
                        'INSERT IGNORE INTO students (full_name, record_book_number, group_id) VALUES (?, ?, ?)',
                        [fullName, recordBook, groupId]
                    );

                    if (studentResult.affectedRows > 0) {
                        studentsAdded++;
                    }
                }
            }

            fs.unlinkSync(req.file.path);
            
            // Чітке повідомлення без припущень
            if (studentsAdded === 0 && groupsAdded === 0) {
                 res.json({ message: "Дані не додано. Перевірте формат файлу." });
            } else {
                 res.json({ message: `Успішно оброблено! Додано студентів: ${studentsAdded}, нових груп: ${groupsAdded}` });
            }

        } catch (err) {
            console.error("Помилка імпорту:", err);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ error: 'Помилка при зчитуванні файлу. Перевірте формат.' });
        }
    });

    app.get('/api/students/dictionary', authenticateToken, async (req, res) => {
        try {
            // Робимо JOIN щоб отримати ім'я групи
            const [students] = await db.query(`
                SELECT s.id, s.full_name, s.record_book_number, sg.group_name 
                FROM students s
                JOIN student_groups sg ON s.group_id = sg.id
                ORDER BY sg.group_name, s.full_name
            `);
            res.json(students);
        } catch (err) {
            console.error("Помилка довідника:", err);
            res.status(500).json({ error: 'Помилка отримання довідника' });
        }
    });

    app.post('/api/documents/upload', authenticateToken, upload.single('document'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Файл не надано' });
        const { table_name, row_id, document_type } = req.body; 
        const filePath = `/uploads/${req.file.filename}`;
        try {
            await db.query(
                'INSERT INTO documents (table_name, row_id, document_type, file_path, original_name) VALUES (?, ?, ?, ?, ?)',
                [table_name, row_id, document_type || 'other', filePath, req.file.originalname]
            );
            res.json({ message: 'Файл збережено', filePath });
        } catch (error) {
            fs.unlinkSync(req.file.path);
            res.status(500).json({ error: 'Помилка бази даних' });
        }
    });

    app.get('/api/documents/:tableName/:rowId', authenticateToken, async (req, res) => {
        try {
            const [docs] = await db.query(
                'SELECT id, document_type, file_path, original_name, uploaded_at FROM documents WHERE table_name = ? AND row_id = ?',
                [req.params.tableName, req.params.rowId]
            );
            res.json(docs);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Отримати всі рядки таблиці
    app.get("/api/table/:tableName", authenticateToken, async (req, res) => {
      try {
          const tableName = req.params.tableName;
          if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return res.status(400).json({error: "Невірна назва таблиці"});
          
          // Робимо правильний JOIN з новими таблицями students та student_groups
          const [rows] = await db.query(`
              SELECT t.ID, t.student_id, 
                    s.record_book_number AS RegistrationNumber, 
                    DATE_FORMAT(t.RegistrationDate, '%Y-%m-%d') AS RegistrationDate, 
                    s.full_name AS StudentName, 
                    sg.group_name AS StudentGroup, 
                    t.Information, t.Contact, t.DocumentType, t.SigningStatus, t.OccupationalSafety
              FROM \`${tableName}\` t
              JOIN students s ON t.student_id = s.id
              JOIN student_groups sg ON s.group_id = sg.id
              ORDER BY t.ID DESC
          `);
          res.json(rows);
      } catch (err) {
          console.error("Помилка завантаження таблиці:", err);
          res.status(500).json({ error: "Помилка завантаження даних" });
      }
    });

    app.get("/api/table", authenticateToken, async (req, res) => {
      try {
        const { tableName } = req.params;
        const [rows] = await db.query(`SELECT * FROM ${tableName}`);
        const formattedRows = rows.map((row) => ({
          ...row,
          RegistrationDate: dateFormat(row["RegistrationDate"]).format(
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
    // Додати рядок у таблицю
    app.post("/api/table/:tableName", authenticateToken, async (req, res) => {
      try {
          const tableName = req.params.tableName;
          if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return res.status(400).json({error: "Невірна назва таблиці"});
          
          const {  student_id, RegistrationDate, Information, Contact, DocumentType, SigningStatus, OccupationalSafety } = req.body;
          
          if (!student_id) return res.status(400).json({error: "Не обрано студента"});

          const sql = `INSERT INTO \`${tableName}\` 
              (student_id, RegistrationDate, Information, Contact, DocumentType, SigningStatus, OccupationalSafety) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`;
          
          await db.query(sql, [student_id, RegistrationDate, Information, Contact, DocumentType, SigningStatus, OccupationalSafety]);
          
          res.json({ message: "Успішно додано" });
      } catch (err) {
          console.error("Помилка збереження запису:", err);
          res.status(500).json({ error: "Помилка збереження в БД" });
      }
    });

    // Пошук у таблиці
    app.get("/api/table/:tableName/search/:input", authenticateToken, async (req, res) => {
      const tableName = req.params.tableName;
      const input = req.params.input;
      if (!input) {
        return res
          .status(400)
          .json({ error: "Missing required query parameter: input" });
      }
      try {
        // Перевірка імені таблиці
        auxiliary.safeTableName(tableName);
        const [results] = await auxiliary.searchInTable(tableName, input, db);
        const formattedResults = results.map((row) => ({
          ...row,
          RegistrationDate: dateFormat(row["RegistrationDate"]).format(
            "DD-MM-YYYY"
          ),
        }));
        res.json(formattedResults);
      } catch (err) {
        console.error("Error in GET /api/table/:tableName/search/:input:", err);
        res
          .status(500)
          .json({ error: "Internal Server Error", details: err.message });
      }
    });

    // Сортування таблиці
    app.get("/api/table/:tableName/sort", authenticateToken, async (req, res) => {
      const tableName = req.params.tableName;
      const sortBy = req.query.by || "StudentName";
      const order = req.query.order === "asc" ? "ASC" : "DESC";
      try {
        const [results] = await db.query(
          `SELECT * FROM \`${tableName}\` ORDER BY \`${sortBy}\` ${order}`
        );
        const formattedResults = results.map((row) => ({
          ...row,
          RegistrationDate: dateFormat(row["RegistrationDate"]).format(
            "DD-MM-YYYY"
          ),
        }));
        res.json(formattedResults);
      } catch (err) {
        res
          .status(500)
          .json({ error: "Cannot sort table", details: err.message });
      }
    });

    // Експорт таблиці
    app.get("/api/table/:tableName/export", authenticateToken, async (req, res) => {
      const tableName = req.params.tableName;
      if (!tableName) {
        return res.status(400).send("Table name is required");
      }
      try {
        const [rows] = await db.query(`SELECT * FROM ${tableName}`);
        const workbook = new ExcelJs.Workbook();
        const worksheet = workbook.addWorksheet(tableName);
        if (rows.length > 0) {
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
          `attachment; filename=${tableName}.xlsx`
        );
        await workbook.xlsx.write(res);
        res.end();
      } catch (err) {
        console.error("Error exporting table to Excel: ", err);
        res.status(500).send("Internal server error");
      }
    });

    //--HTTP clone row in table method--
    app.post("/api/table/:tableName/clone/:id", authenticateToken, async (req, res) => {
      const tableName = req.params.tableName;
      const id = req.params.id;
      try {
        const [rows] = await db.query(
          `SELECT * FROM \`${tableName}\` WHERE id = ?`,
          [id]
        );
        if (rows.length === 0) {
          return res.status(404).json({ error: "Row not found" });
        }
        const row = rows[0];
        
        // Remove ID field (handle both 'id' and 'ID' cases)
        delete row.id;
        delete row.ID;

        // Build INSERT query with proper placeholders
        const columns = Object.keys(row).filter(col => col.toLowerCase() !== 'id');
        const values = columns.map(col => row[col]);
        const placeholders = columns.map(() => "?").join(", ");
        const columnsList = columns.map((col) => `\`${col}\``).join(", ");

        const [results] = await db.query(
          `INSERT INTO \`${tableName}\` (${columnsList}) VALUES (${placeholders})`,
          values
        );
        res.json({ id: results.insertId });
      } catch (err) {
        console.error("Clone error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    //--HTTP edit row in table method--
    // Оновлення рядка
    app.put("/api/table/:tableName/:id", authenticateToken, async (req, res) => {
        try {
            const { tableName, id } = req.params;
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return res.status(400).json({error: "Невірна назва таблиці"});
            
            const { student_id, RegistrationDate, Information, Contact, DocumentType, SigningStatus, OccupationalSafety } = req.body;
            
            if (!student_id) return res.status(400).json({error: "Не обрано студента"});

            const sql = `UPDATE \`${tableName}\` SET 
                student_id=?, RegistrationDate=?, Information=?, Contact=?, DocumentType=?, SigningStatus=?, OccupationalSafety=? 
                WHERE ID=?`;
            
            await db.query(sql, [student_id, RegistrationDate, Information, Contact, DocumentType, SigningStatus, OccupationalSafety, id]);
            
            res.json({ message: "Успішно оновлено" });
        } catch (err) {
            console.error("Помилка оновлення запису:", err);
            res.status(500).json({ error: "Помилка оновлення" });
        }
    });

    //--HTTP delete row in table method--
    // Видалення рядка
    app.delete("/api/table/:tableName/:id", authenticateToken, async (req, res) => {
        try {
            const { tableName, id } = req.params;
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return res.status(400).json({error: "Невірна назва таблиці"});
            
            await db.query(`DELETE FROM \`${tableName}\` WHERE ID=?`, [id]);
            res.json({ message: "Успішно видалено" });
        } catch (err) {
            console.error("Помилка видалення:", err);
            res.status(500).json({ error: "Помилка видалення" });
        }
    });

    // Endpoint: отримати назви стовпців і коментарі для таблиці(потрібно для створення кастомних таблиць, які були імпортовані і не мають стандартних стовпців)
    app.get("/api/table/:tableName/columns", authenticateToken, async (req, res) => {
      try {
        const tableName = req.params.tableName;
        if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
          return res.status(400).json({ error: "Неправильна назва таблиці" });
        }
        // Отримати інформацію про стовпці з коментарями (якщо є)
        const [columns] = await db.query(
          `SHOW FULL COLUMNS FROM \`${tableName}\``
        );
        // Повертаємо масив: [{field, comment}]
        res.json(
          columns.map((col) => ({ field: col.Field, comment: col.Comment }))
        );
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    async function getDataWithPagination(tableName, page = 1, limit = 10) {
      const offset = (page - 1) * limit;
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error("Invalid table name");
      
      const tableId = `\`${tableName}\``;
      let rows = [];
      
      if (tableName === "meta_tables") {
        // Оновлений запит для meta_tables
        const [r] = await db.query(
          `SELECT id, tableName AS name, descriptionField, created_at, updated_at FROM ${tableId} LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        rows = r;
      } else {
        // ОНОВЛЕНИЙ ЗАПИТ: Об'єднуємо динамічну таблицю з довідником студентів
        const [r] = await db.query(
          `SELECT t.ID, t.student_id, sd.record_book_number AS RegistrationNumber, 
                  t.RegistrationDate, sd.full_name AS StudentName, sd.group_name AS StudentGroup, 
                  t.Information, t.Contact, t.DocumentType, t.SigningStatus, t.OccupationalSafety
          FROM ${tableId} t
          JOIN students_dictionary sd ON t.student_id = sd.id
          LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        rows = r;
      }

      const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM ${tableId}`);
      return {
        data: rows,
        total: (countRows && countRows[0] && countRows[0].total) || 0,
        page,
        totalPages: Math.ceil((countRows && countRows[0] && countRows[0].total) / limit),
      };
    }

    // Отримати список груп для селекту
    app.get("/api/groups/:tableName", authenticateToken, async (req, res) => {
      const tableName = req.params.tableName;
      try {
        const [rows] = await db.query(
          `SELECT groups_count, entry_year FROM meta_tables WHERE tableName='${tableName}';`
        );
        let groups = [];
        rows.forEach((row) => {
          const yearShort = row.entry_year
            ? row.entry_year.toString().slice(-2)
            : "";
          for (let i = 1; i <= row.groups_count; i++) {
            groups.push({
              id: `${i}КН-${yearShort}б`,
              label: `${i}КН-${yearShort}б`,
            });
          }
        });
        res.json(groups);
      } catch (err) {
        console.error("Помилка при отриманні груп:", err);
        res.status(500).json({ error: "Не вдалося отримати групи" });
      }
    });
  } catch (err) {
    console.error("Failed to start server: ", err);
  }
})();
