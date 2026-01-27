import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Add a test log to verify connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL Database');
});

export default pool;