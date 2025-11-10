const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const saltRounds = 10;

// --- Скопируйте настройки из вашего server.js ---
const mysqlConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'skud',
    password: 'Favz050505',
    database: 'SKUD',
    charset: 'utf8mb4'
};

// --- Данные нового администратора ---
const newAdmin = {
    username: 'admin',
    password: 'admin'
};

async function addAdminUser() {
    let connection;
    try {
        console.log('Подключение к базе данных...');
        connection = await mysql.createConnection(mysqlConfig);
        console.log('Успешно подключено.');

        // 1. Проверяем, существует ли пользователь
        console.log(`Проверка наличия пользователя '${newAdmin.username}'...`);
        const [rows] = await connection.execute('SELECT id FROM users WHERE username = ?', [newAdmin.username]);

        if (rows.length > 0) {
            console.log(`Пользователь '${newAdmin.username}' уже существует. Обновляем его пароль.`);
            
            // 2а. Хешируем новый пароль
            console.log('Хеширование нового пароля...');
            const hash = await bcrypt.hash(newAdmin.password, saltRounds);
            console.log('Пароль успешно хеширован.');

            // 2b. Обновляем пароль существующего пользователя
            await connection.execute('UPDATE users SET password = ? WHERE username = ?', [hash, newAdmin.username]);
            console.log(`\x1b[32m%s\x1b[0m`, `✔ Пароль для пользователя '${newAdmin.username}' успешно обновлен на '${newAdmin.password}'.`);

        } else {
            console.log(`Пользователь '${newAdmin.username}' не найден. Создаем нового.`);

            // 3a. Хешируем пароль
            console.log('Хеширование пароля...');
            const hash = await bcrypt.hash(newAdmin.password, saltRounds);
            console.log('Пароль успешно хеширован.');

            // 3b. Вставляем нового пользователя в базу
            await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [newAdmin.username, hash]);
            console.log(`\x1b[32m%s\x1b[0m`, `✔ Пользователь '${newAdmin.username}' с паролем '${newAdmin.password}' успешно создан!`);
        }

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `!!! ОШИБКА: ${error.message}`);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Соединение с базой данных закрыто.');
        }
    }
}

addAdminUser();
