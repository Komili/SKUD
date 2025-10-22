const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const bcrypt = require('bcrypt');
const saltRounds = 10;

// --- Глобальные настройки ---
const PORT = 3001;
const TELEGRAM_TOKEN = '8474518444:AAHbd-tFIrYUtI7jqdbzRBfqc6mRZwbD-sI';
const TELEGRAM_CHAT_ID = '305812935';

// --- Настройки MySQL ---
const mysqlConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'skud',
    password: 'skud',
    database: 'skud',
    charset: 'utf8mb4'
};

// --- Инициализация ---
const app = express();
const bot = new TelegramBot(TELEGRAM_TOKEN);
const uploadsDir = path.join(__dirname, 'uploads');
let serverStartTime;
let pool;

// --- Настройка хранилища ---
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        // Используем ФИО из тела запроса, очищаем его и добавляем временную метку для уникальности
        const sanitizedFullName = (req.body.fullName || 'employee')
            .replace(/[^a-z0-9а-яё\s]/gi, '') // Удаляем недопустимые символы
            .replace(/\s+/g, '_'); // Заменяем пробелы на подчеркивания
        
        cb(null, `${sanitizedFullName}-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage });


// --- Главная функция запуска ---
async function main() {
    try {
        pool = mysql.createPool(mysqlConfig);
        console.log('Успешное подключение к базе данных MySQL.');

        await setupDatabase();
        await migrateFromSqlite();

        startServer();
        const { startListener } = require('./isup-listener');
        startListener();

    } catch (error) {
        console.error('!!! КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться или настроить MySQL:', error.message);
        process.exit(1);
    }
}

// --- Пустые функции-заглушки, т.к. настройка и миграция уже завершены ---
async function setupDatabase() {}
async function migrateFromSqlite() {}


// --- Запуск сервера и Middleware ---
function startServer() {
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static(uploadsDir));

    // --- Роуты API ---

    // События от терминала
    app.post('/api/hikvision/event', express.text({ type: '*/*' }), async (req, res) => {
        try {
            const jsonMatch = req.body.match(/{[\s\S]*}/);
            if (!jsonMatch) return res.status(200).send('OK (Ignored)');
            
            const data = JSON.parse(jsonMatch[0]);
            const eventTimestamp = new Date(data.dateTime);

            if (serverStartTime && eventTimestamp < serverStartTime) {
                return res.status(200).send('OK (Ignored, old event)');
            }
            
            const event = data.AccessControllerEvent;
            if (!event) return res.status(200).send('OK (Ignored)');

            const time = eventTimestamp.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const employeeId = event.employeeNo || event.employeeNoString;
            const deviceName = event.deviceName || 'Терминал';

            if (employeeId) {
                const ipAddress = data.ipAddress;
                const eventType = (ipAddress === '192.168.1.190') ? 'entry' : 'exit';
                const eventDate = new Date(eventTimestamp).toISOString().split('T')[0];

                const [empRows] = await pool.execute('SELECT fullName FROM employees WHERE id = ?', [employeeId]);
                const name = empRows.length > 0 ? empRows[0].fullName : `ID ${employeeId}`;

                if (eventType === 'entry') {
                    const message = `✅ *Вход*\n\n👤 **Сотрудник:** ${name}\n📍 **Устройство:** ${deviceName}\n⏰ **Время:** ${time}`;
                    bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' })
                        .catch(err => console.error('[Telegram Error]', err.message));

                    const [existing] = await pool.execute(`SELECT id FROM attendance_logs WHERE employeeId = ? AND eventType = 'entry' AND DATE(timestamp) = ?`, [employeeId, eventDate]);
                    if (existing.length === 0) {
                        await pool.execute('INSERT INTO attendance_logs (employeeId, timestamp, eventType) VALUES (?, ?, ?)', [employeeId, eventTimestamp, eventType]);
                    }
                } else {
                    const message = `🔴 *Выход*\n\n👤 **Сотрудник:** ${name}\n📍 **Устройство:** ${deviceName}\n⏰ **Время:** ${time}`;
                    bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' })
                        .catch(err => console.error('[Telegram Error]', err.message));

                    const [existing] = await pool.execute(`SELECT id FROM attendance_logs WHERE employeeId = ? AND eventType = 'exit' AND DATE(timestamp) = ?`, [employeeId, eventDate]);
                    if (existing.length === 0) {
                        await pool.execute('INSERT INTO attendance_logs (employeeId, timestamp, eventType) VALUES (?, ?, ?)', [employeeId, eventTimestamp, eventType]);
                    } else {
                        await pool.execute('UPDATE attendance_logs SET timestamp = ? WHERE id = ?', [eventTimestamp, existing[0].id]);
                    }
                }
                
                return res.status(200).send('OK (Access Event Handled)');
            }
            
            /*
            // Уведомления о двери (отключено)
            switch (event.subEventType) {
                case 76: case 21:
                    const openMsg = `🚪 *Дверь открыта*\n\n📍 **Устройство:** ${deviceName}\n⏰ **Время:** ${time}`;
                    bot.sendMessage(TELEGRAM_CHAT_ID, openMsg, { parse_mode: 'Markdown' });
                    break;
                case 75: case 22:
                    const closeMsg = `🔒 *Дверь закрыта*\n\n📍 **Устройство:** ${deviceName}\n⏰ **Время:** ${time}`;
                    bot.sendMessage(TELEGRAM_CHAT_ID, closeMsg, { parse_mode: 'Markdown' });
                    break;
            }
            */
            
            res.status(200).send('OK (System Event)');
        } catch (error) {
            console.error("ОШИБКА ОБРАБОТКИ СОБЫТИЯ:", error);
            res.status(200).send('OK (Error Ignored)');
        }
    });

    // --- ВОССТАНОВЛЕННЫЕ ЭНДПОИНТЫ ---

    // Аутентификация
    app.post('/api/auth/login', async (req, res) => {
        const { username, password } = req.body;
        try {
            const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
            if (rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Неверное имя пользователя или пароль.' });
            }
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                res.json({ success: true });
            } else {
                res.status(401).json({ success: false, message: 'Неверное имя пользователя или пароль.' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера.' });
        }
    });

    // CRUD Сотрудников
    app.post('/api/employees', upload.single('photo'), async (req, res) => {
        try {
            const { fullName, position, companyId, departmentId, phoneNumber, email, status, dateOfBirth, hireDate } = req.body;
            const photoUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.png';

            if (!companyId || !departmentId) {
                return res.status(400).json({ error: 'Необходимо выбрать компанию и отдел.' });
            }

            // Функция для форматирования даты в YYYY-MM-DD
            const formatDate = (dateString) => {
                if (!dateString) return null;
                return new Date(dateString).toISOString().split('T')[0];
            };

            // Преобразуем пустые строки и форматируем даты
            const finalDateOfBirth = formatDate(dateOfBirth);
            const finalHireDate = formatDate(hireDate);

            const sql = `
                INSERT INTO employees 
                (fullName, position, companyId, departmentId, phoneNumber, email, photoUrl, status, dateOfBirth, hireDate) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [fullName, position, companyId, departmentId, phoneNumber, email, photoUrl, status, finalDateOfBirth, finalHireDate];
            
            await pool.execute(sql, params);
            res.status(201).json({ message: 'Сотрудник успешно добавлен' });
        } catch (error) {
            console.error('ПОЛНАЯ ОШИБКА при добавлении сотрудника:', error);
            let errorMessage = 'Внутренняя ошибка сервера.';
            if (error.code === 'ER_DUP_ENTRY') {
                errorMessage = 'Сотрудник с таким Email или телефоном уже существует.';
            } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                errorMessage = 'Выбранная компания или отдел не существуют. Убедитесь, что справочники не пусты.';
            } else if (error.code === 'ER_BAD_NULL_ERROR') {
                const columnNameMatch = error.sqlMessage.match(/'([^']*)'/);
                const columnName = columnNameMatch ? columnNameMatch[1] : 'неизвестное поле';
                errorMessage = `Поле '${columnName}' является обязательным и не может быть пустым.`;
            }
            res.status(500).json({ error: errorMessage });
        }
    });

    app.put('/api/employees/:id', upload.single('photo'), async (req, res) => {
        try {
            const { id } = req.params;
            const { fullName, position, companyId, departmentId, phoneNumber, email, status, dateOfBirth, hireDate } = req.body;
            
            let photoUrl = req.body.photoUrl;
            if (req.file) {
                photoUrl = `/uploads/${req.file.filename}`;
                const [rows] = await pool.execute('SELECT photoUrl FROM employees WHERE id = ?', [id]);
                if (rows.length > 0 && rows[0].photoUrl && rows[0].photoUrl !== '/uploads/placeholder.png') {
                    const oldPath = path.join(__dirname, rows[0].photoUrl);
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
            }

            // Функция для форматирования даты в YYYY-MM-DD
            const formatDate = (dateString) => {
                if (!dateString) return null;
                return new Date(dateString).toISOString().split('T')[0];
            };

            const finalDateOfBirth = formatDate(dateOfBirth);
            const finalHireDate = formatDate(hireDate);

            const sql = `
                UPDATE employees SET 
                fullName = ?, position = ?, companyId = ?, departmentId = ?, phoneNumber = ?, 
                email = ?, photoUrl = ?, status = ?, dateOfBirth = ?, hireDate = ?
                WHERE id = ?
            `;
            const params = [fullName, position, companyId, departmentId, phoneNumber, email, photoUrl, status, finalDateOfBirth, finalHireDate, id];

            await pool.execute(sql, params);
            res.json({ message: 'Данные сотрудника обновлены' });
        } catch (error) {
            console.error('ПОЛНАЯ ОШИБКА при обновлении сотрудника:', error);
            let errorMessage = 'Внутренняя ошибка сервера.';
            if (error.code === 'ER_DUP_ENTRY') {
                errorMessage = 'Сотрудник с таким Email или телефоном уже существует.';
            } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                errorMessage = 'Выбранная компания или отдел не существуют.';
            } else if (error.code === 'ER_BAD_NULL_ERROR') {
                const columnNameMatch = error.sqlMessage.match(/'([^']*)'/);
                const columnName = columnNameMatch ? columnNameMatch[1] : 'неизвестное поле';
                errorMessage = `Поле '${columnName}' является обязательным и не может быть пустым.`;
            }
            res.status(500).json({ error: errorMessage });
        }
    });

    app.delete('/api/employees/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Сначала получаем путь к фото, чтобы удалить файл
            const [rows] = await pool.execute('SELECT photoUrl FROM employees WHERE id = ?', [id]);
            if (rows.length > 0 && rows[0].photoUrl && rows[0].photoUrl !== '/uploads/placeholder.png') {
                const photoPath = path.join(__dirname, rows[0].photoUrl);
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            }

            // Удаляем запись из базы
            const [result] = await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Сотрудник с таким ID не найден.' });
            }
            
            res.json({ message: 'Сотрудник удален' });
        } catch (error) {
            console.error('Ошибка при удалении сотрудника:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
        }
    });

    app.get('/api/employees', async (req, res) => {
        try {
            const sql = `
                SELECT 
                    e.id, e.fullName, e.position, c.name AS companyName, e.phoneNumber, e.photoUrl, e.status, e.dateOfBirth
                FROM employees e
                LEFT JOIN companies c ON e.companyId = c.id
                ORDER BY e.fullName
            `;
            const [rows] = await pool.query(sql);
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    app.get('/api/employees/:id', async (req, res) => {
        try {
            const sql = `
                SELECT 
                    e.id, e.fullName, e.position, d.name AS departmentName, c.name AS companyName, 
                    e.phoneNumber, e.email, e.photoUrl, e.status, e.dateOfBirth, e.hireDate,
                    e.companyId, e.departmentId
                FROM employees e
                LEFT JOIN companies c ON e.companyId = c.id
                LEFT JOIN departments d ON e.departmentId = d.id
                WHERE e.id = ?
            `;
            const [rows] = await pool.execute(sql, [req.params.id]);
            if (rows.length > 0) {
                res.json(rows[0]);
            } else {
                res.status(404).json({ error: 'Сотрудник не найден' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    // Справочники
    app.get('/api/companies', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM companies ORDER BY name');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    app.get('/api/departments', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM departments ORDER BY name');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    // Отчеты
    app.get('/api/reports/attendance', async (req, res) => {
        const { startDate, endDate, companyId, employeeId } = req.query;
        try {
            let sql = `
                SELECT
                    e.id AS employeeId, e.fullName, DATE_FORMAT(al.timestamp, '%Y-%m-%d') as date,
                    MIN(CASE WHEN al.eventType = 'entry' THEN TIME(al.timestamp) END) as firstEntry,
                    MAX(CASE WHEN al.eventType = 'exit' THEN TIME(al.timestamp) END) as lastExit
                FROM attendance_logs al
                JOIN employees e ON e.id = al.employeeId
                WHERE DATE(al.timestamp) BETWEEN ? AND ?
            `;
            const params = [startDate, endDate];

            if (companyId) sql += ' AND e.companyId = ?', params.push(companyId);
            if (employeeId) sql += ' AND e.id = ?', params.push(employeeId);
            
            sql += ` GROUP BY e.id, date ORDER BY date DESC, e.fullName`;

            const [rows] = await pool.execute(sql, params);
            
            const processedRows = rows.map(row => {
                let workedHours = 'N/A';
                if (row.firstEntry && row.lastExit) {
                    const entry = new Date(`1970-01-01T${row.firstEntry}`);
                    const exit = new Date(`1970-01-01T${row.lastExit}`);
                    if (exit > entry) {
                        const diffMs = exit - entry;
                        const hours = Math.floor(diffMs / 3600000);
                        const minutes = Math.floor((diffMs % 3600000) / 60000);
                        workedHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    }
                }
                return { ...row, workedHours };
            });
            res.json(processedRows);
        } catch (error) {
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });
    
    app.listen(PORT, () => {
        serverStartTime = new Date();
        console.log(`🚀 **Финальный сервер v3 (MySQL)** запущен на порту ${PORT}!`);
        bot.sendMessage(TELEGRAM_CHAT_ID, '🚀 **Финальный сервер v3 (MySQL)** запущен!', { parse_mode: 'Markdown' });
    });
}

// --- Запускаем все ---
main();
