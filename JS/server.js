const getDbConnection = require('./db.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { error } = require('console');
const auxiliary = require('./functions.js');
const dateFormat = require('dayjs');
const ExcelJs = require('exceljs');
const { write } = require('fs');

const app = express();
(async () => {
    try{
        const db = await getDbConnection();
        console.log('Connected to db!');

        app.use(cors());
        app.use(bodyParser.json());
        app.use(express.static('../public'));
        app.use(express.static('../public/html'));
        app.use('/css', express.static('../public/css'));
        app.use('/JS', express.static(__dirname));
        
        app.get('/', (req, res) =>{
            res.sendFile(path.join(__dirname, "../public", "html", 'index.html'));
        });
        
        app.post('/', async (req, res) =>{
            console.log(req.body);
            try{
                const [dbRows] = await db.query(`
                CREATE TABLE IF NOT EXISTS ?(
                    ID INT auto_increment primary key,
                    registrationNumber varchar(30),
                    registrationDate DATE,
                    name varchar(255),
                    studentGroup varchar(30),
                    information varchar(500),
                    contact varchar(255),
                    documentType varchar(30),
                    signingStatus varchar(30),
                    op varchar(30)
                );`, [tableName]);
            } catch(err) {
                res.status(500).json(err);
            }
        });
        
        app.get('/table', async (req, res) => {
            try{
                const [rows] = await db.query('SELECT * FROM year2025');
                const formattedRows = rows.map(row => ({
                    ...row,
                    registrationDate: dateFormat(row.registrationDate).format('DD-MM-YYYY'),
                }));
                res.json(formattedRows);
            } catch(err) {
                res.status(500).json(err);
            }
        });
        
        //-- Method to add data into the table with generation of registration number --
         // This method is used to add a new row to the table with a generated registration number
        app.post('/table', async (req, res) =>{
            try{
                const { name, registrationDate, information, contact, studentGroup, documentType, signingStatus, op } = req.body;
                
                if (!name) {
                    return res.status(400).json({ error: 'Missing required field: name' });
                }

                const registrationNumber = await auxiliary.generateRegistrationNumber('08-32', db);
                const [result] = await db.query('INSERT INTO year2025 SET ?', 
                    { name, registrationNumber, registrationDate, information, contact, studentGroup, documentType, signingStatus, op }
                );
                res.json({ id: result.insertId });
            } catch (err) {
                console.error('Error in POST /table:', err);
                res.status(500).json({ error: 'Internal Server Error', details: err.message });
            }
        });

        app.get('/table/search/:input', async (req, res) => {
            const input = req.params.input;
            if (!input) {
                return res.status(400).json({ error: 'Missing required query parameter: input' });
            }
            try{
                const [results] = await auxiliary.searchInTable(input, db);
                const formattedResults = results.map(row => ({
                    ...row,
                    registrationDate: dateFormat(row.registrationDate).format('DD-MM-YYYY'),
                }));
                res.json(formattedResults);
            } catch(err) {
                console.error('Error in GET /table/search:', err);
                res.status(500).json({ error: 'Internal Server Error', details: err.message });
            }
        });

        app.get('/table/sort/', async (req, res) => {
            const sortBy = req.query.by || 'name';
            const order = req.query.order === 'asc' ? 'ASC':'DESC';
            const allowedFields = ['name', 'registrationDate', 'studentGroup'];

            try{
                if(!allowedFields.includes(sortBy)){
                    res.status(400).send('Invalid sort field');
                }
                const [results] = await db.query(`SELECT * FROM year2025 ORDER BY ${sortBy} ${order}`);
                const formattedResults = results.map(row => ({
                    ...row,
                    registrationDate: dateFormat(row.registrationDate).format('DD-MM-YYYY'),
                }));
                res.json(formattedResults);
            }catch(err){
                res.status(500).json({error: 'Cannot sort table by name', details: err.message});
            }
        })
        
        app.get('/table/export', async (req, res) =>{
            const table = req.query.table;

            if(!table){
                return res.status(400).send('Table name is required');
            }

            try{
                const [rows] = await db.query(`SELECT * FROM year2025`);

                const workbook = new ExcelJs.Workbook();
                const worksheet = workbook.addWorksheet(table);

                if(rows.length > 0){
                    //Add column header
                    worksheet.columns = Object.keys(rows[0]).map(key =>({
                        header: key,
                        key: key,
                        width: 20
                    }));

                    rows.forEach(row => worksheet.addRow(row));
                }

                res.setHeader('Content-Type', 'application/wnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Description', `attachment; filename=${table}.xlsx`);

                await workbook.xlsx.write(res);
                res.end();
            }catch (err) {
                console.error('Error exporting table to Excel: ', err);
                res.status(500).send('Internal server error');
            }
        })

        //--HTTP clone row method--
        app.post('/table/clone/:id', async (req, res) => {
            const id = req.params.id;
        
            try{
                const [rows] = await db.query('SELECT * FROM year2025 WHERE id = ?', [id]);
                if(rows.length === 0) {
                    return res.status(404).json({ error: 'Row not found' });
                }
                const row = rows[0];

                const [results] = await db.query(
                    'INSERT INTO year2025(name, registrationNumber, registrationDate, information, contact, studentGroup, documentType, signingStatus, op) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                     [
                        row.name, row.registrationNumber, row.registrationDate, row.information, 
                        row.contact, row.studentGroup, row.documentType, row.signingStatus, row.op
                    ]
                );

                res.json({ id: results.insertId });
            } catch(err) {
                res.status(500).json(err);
            }
            
        });
        
        //--HTTP edit row method--
        app.put('/table/:id', async (req, res) => {
            const { name, registrationDate, information, contact, studentGroup, documentType, signingStatus, op } = req.body;
            try{
                await db.query(
                    'UPDATE year2025 SET name = ?, registrationDate = ?, information = ?, contact = ?, studentGroup = ?, documentType = ?, signingStatus = ?, op = ? WHERE id = ?',
                    [name, registrationDate, information, contact, studentGroup, documentType, signingStatus, op, req.params.id]
                );

                res.json({ message: 'Row updated successfully' });
            } catch(err) {
                res.status(500).json(err);
            }            
        });
        
        //--HTTP delete row method--
        app.delete('/table/:id', async (req, res) => {
            try{
                db.query('DELETE FROM year2025 WHERE id = ?', [req.params.id]);
                res.sendStatus(200);
            } catch (err) {
                res.status(500).json(err);
            }
        });
        
        const PORT = process.env.PORT || 3308;
        app.listen(PORT, ()=>{
            console.log(`Server running on port: ${PORT}`);
        });
        
    } catch(err){
        console.error('Failed to start server: ', err);
    }

})

();