const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askSecret(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error('Ejecuta este comando desde una terminal interactiva para no mostrar la contraseña.'));
      return;
    }
    process.stdout.write(prompt);
    let value = '';
    const onData = (chunk) => {
      const key = chunk.toString();
      if (key === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error('Operación cancelada.'));
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
      } else {
        value += key;
      }
    };
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.on('data', onData);
  });
}

async function bootstrapAdmin() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') throw new Error('Solo se permite crear el administrador inicial en bd_matricula.');
    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) AS total FROM usuario_roles ur
       JOIN roles r ON r.id_rol=ur.id_rol WHERE r.nombre='Administrador'`
    );
    if (Number(total) > 0) throw new Error('Ya existe un administrador; el bootstrap inicial se bloqueó.');

    const username = await ask('Usuario administrador: ');
    const email = await ask('Correo administrador: ');
    const password = await askSecret('Contraseña (mínimo 12 caracteres, entrada oculta): ');
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error('Usuario inválido (3-80 caracteres alfanuméricos, punto, guion o guion bajo).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo inválido.');
    if (password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO usuarios (usuario,email,password_hash) VALUES (?,?,?)",
      [username, email.toLowerCase(), passwordHash]
    );
    const [roleLink] = await connection.query(
      `INSERT INTO usuario_roles (id_usuario,id_rol)
       SELECT ?,id_rol FROM roles WHERE nombre='Administrador'`,
      [result.insertId]
    );
    if (roleLink.affectedRows !== 1) throw new Error('No se encontró el rol Administrador en la migración.');
    await connection.commit();
    console.log('Administrador inicial creado. Guarda el usuario y la contraseña de forma segura.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

bootstrapAdmin().catch((error) => {
  console.error('No se pudo crear el administrador inicial:', error.message);
  process.exitCode = 1;
});
