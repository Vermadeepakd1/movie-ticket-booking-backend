// db.js
const { Pool } = require('pg');
require('dotenv').config();

// Configuration object that adapts to the environment
const connectionConfig = {
    // If DATABASE_URL is present (on Render), use it with SSL
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? {
        rejectUnauthorized: false
    } : false
};

// If DATABASE_URL is NOT present (local development), use .env variables
if (!process.env.DATABASE_URL) {
    connectionConfig.user = process.env.DB_USER;
    connectionConfig.host = process.env.DB_HOST;
    connectionConfig.database = process.env.DB_DATABASE;
    connectionConfig.password = process.env.DB_PASSWORD;
    connectionConfig.port = process.env.DB_PORT;
}

const pool = new Pool(connectionConfig);

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error', err.stack);
    } else {
        console.log('✅ Database connected successfully');
    }
});

module.exports = pool;