const getDbConnection = require('./db.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { error } = require('console');
const auxiliary = require('./functions.js');
const dateFormat = require('dayjs');

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
        
        app.get('/', (req, res) =>{
            res.sendFile(path.join('public', 'html', 'index.html'));
        });
        
        app.post('/', (req, res) =>{
            console.log(req.body);
        });
        
        app.get('/table', async (_, res) => {
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
                const { name, date, information, contact, studentGroup, documentType, signingStatus } = req.body;
                
                if (!name) {
                    return res.status(400).json({ error: 'Missing required field: name' });
                }                
                const registrationDate = new Date(date).toISOString().split('T')[0];

                const registrationNumber = await auxiliary.generateRegistrationNumber('08-32', db);
                const [result] = await db.query('INSERT INTO year2025 SET ?', 
                    { name, registrationNumber, registrationDate, information, contact, studentGroup, documentType, signingStatus }
                );
                res.json({ id: result.insertId });
            } catch (err) {
                console.error('Error in POST /table:', err);
                res.status(500).json({ error: 'Internal Server Error', details: err.message });
            }
        });
        
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
                    'INSERT INTO year2025(name, registrationNumber, registrationDate, information, contact, studentGroup, documentType, signingStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                     [
                        row.name, row.registrationNumber, row.registrationDate, row.information, 
                        row.contact, row.studentGroup, row.documentType, row.signingStatus
                    ]
                );

                res.json({ id: results.insertId });
            } catch(err) {
                res.status(500).json(err);
            }
            
        });
        
        //--HTTP edit row method--
        app.put('/table/:id', async (req, res) => {
            const { name, registrationDate, information, contact, studentGroup, documentType, signingStatus } = req.body;
            try{
                await db.query(
                    'UPDATE year2025 SET name = ?, registrationDate = ?, information = ?, contact = ?, studentGroup = ?, documentType = ?, signingStatus = ? WHERE id = ?',
                    [name, registrationDate, information, contact, studentGroup, documentType, signingStatus, req.params.id]
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