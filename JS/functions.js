async function generateRegistrationNumber(departmentID, connection) {
    let d = new Date();
    let year = d.getFullYear().toString().substr(-2);

    const [rows] = await connection.execute(
        `SELECT registrationNumber
         FROM year2025
         WHERE registrationNumber LIKE ?
         ORDER BY id DESC LIMIT 1`,
        [`${departmentID}.%:%`]
        );

    let nextSerial = 1;

    if(rows.length > 0) {
        const lastReg = rows[0].registrationNumber;
        const match = lastReg.match(/\.(\d+):/);
        if(match) {
            nextSerial = parseInt(match[1], 10) + 1;
        }
    }

    const paddedSerial = nextSerial.toString().padStart(2, '0');
    const newRegistrationNumber = `${departmentID}.${paddedSerial}:${year}`;

    return newRegistrationNumber;
}

async function searchInTable(input, connection) {
    try{
        const [result] = await connection.query(
            `SELECT * FROM year2025
             WHERE name LIKE ? OR registrationNumber LIKE ?`,
            [`%${input}%`, `%${input}%`]
        );
        return [result];
    }catch(err) {
        console.error('Error while searching:', err);
        throw new Error('Database query failed');
    }
}

module.exports = {
    generateRegistrationNumber,
    searchInTable
};