const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

if (!Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD')) {
  throw new Error('Configura DB_PASSWORD en el archivo .env del backend.');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bd_matricula',
  port: Number(process.env.DB_PORT) || 3308,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
