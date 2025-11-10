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
const TELEGRAM_CHAT_IDS = ['305812935', '5409029684', '887623148'];

// Вспомогательная функция для отправки сообщения на все ID в списке
function sendTelegramMessage(message, options) {
    TELEGRAM_CHAT_IDS.forEach(chatId => {
        bot.sendMessage(chatId, message, options)
           .catch(err => console.error(`[Telegram Error] Не удалось отправить сообщение на ${chatId}:`, err.message));
    });
}

// --- Настройки MySQL ---
const mysqlConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'skud',
    password: 'Favz050505',
    database: 'SKUD',
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
            // console.log("--- [HIKVISION EVENT RECEIVED] ---");
            // console.log("Raw Body:", req.body);

            const jsonMatch = req.body.match(/{[\s\S]*}/);
            if (!jsonMatch) {
                // console.log("No JSON found in body. Ignoring.");
                return res.status(200).send('OK (Ignored, no JSON)');
            }
            
            const data = JSON.parse(jsonMatch[0]);
            // console.log("Parsed Data:", JSON.stringify(data, null, 2));

            const eventTimestamp = new Date(data.dateTime);

            if (serverStartTime && eventTimestamp < serverStartTime) {
                // console.log("Ignoring old event from before server start.");
                return res.status(200).send('OK (Ignored, old event)');
            }
            
            const event = data.AccessControllerEvent;
            if (!event) {
                // console.log("No AccessControllerEvent in data. Ignoring.");
                return res.status(200).send('OK (Ignored, not an access event)');
            }

            // --- Определение местоположения и типа события по IP терминала ---
            const terminalIp = data.ipAddress;
            const officeMapping = {
                '192.168.1.190': { office: 'Makon', door: 'Вход (Снаружи)', type: 'entry' },
                '192.168.1.191': { office: 'Makon', door: 'Выход (Внутри)', type: 'exit' },
                '192.168.0.161': { office: 'Favz', door: 'Вход (Снаружи)', type: 'entry' },
                '192.168.0.160': { office: 'Favz', door: 'Выход (Внутри)', type: 'exit' }
            };
            const detectedLocation = officeMapping[terminalIp];

            // Если IP не найден в списке, событие игнорируется
            if (!detectedLocation) {
                console.warn(`[ПРЕДУПРЕЖДЕНИЕ] Получено событие с неизвестного IP терминала: ${terminalIp}. Игнорируется.`);
                return res.status(200).send('OK (Ignored, unknown terminal IP)');
            }

            const officeName = detectedLocation.office;
            const doorDescription = detectedLocation.door;
            const eventType = detectedLocation.type; // <-- Новая, надежная логика

            // --- Обработка события удаленной разблокировки двери ---
            if (event.majorEventType === 3 && event.subEventType === 1024) {
                const remoteHost = event.remoteHostAddr || 'Неизвестный хост';
                const time = eventTimestamp.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                const message = `🔓 *Дверь разблокирована удаленно*\n\n🏢 **Офис:** ${officeName}\n🚪 **Дверь:** ${doorDescription}\n💻 **С хоста:** ${remoteHost}\n⏰ **Время:** ${time}`;
                
                sendTelegramMessage(message, { parse_mode: 'Markdown' });
                
                console.log(`[HIKVISION EVENT] Отправлено уведомление об удаленной разблокировке двери: ${officeName} (${doorDescription}) с ${remoteHost}`);
                return res.status(200).send('OK (Remote Unlock Event Handled)');
            }

            const time = eventTimestamp.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const employeeIdRaw = event.employeeNo || event.employeeNoString;
            
            if (employeeIdRaw) {
                const employeeId = parseInt(employeeIdRaw, 10);
                if (isNaN(employeeId)) {
                    console.error(`Failed to parse employeeId: '${employeeIdRaw}' is not a valid number.`);
                    return res.status(200).send('OK (Error, invalid employeeId)');
                }

                // --- ПРОВЕРКА НА СУЩЕСТВОВАНИЕ СОТРУДНИКА ---
                const [empRows] = await pool.execute('SELECT fullName FROM employees WHERE id = ?', [employeeId]);
                const eventIcon = eventType === 'entry' ? '🟢' : '🔴';

                if (empRows.length === 0) {
                    console.warn(`[ПРЕДУПРЕЖДЕНИЕ] Получено событие для неизвестного сотрудника с ID: ${employeeId}. Игнорируется.`);
                    const warningMessage = `⚠️ *Обнаружен неизвестный сотрудник*\n\n🏢 **Офис:** ${officeName}\n🚪 **Дверь:** ${doorDescription}\n🆔 **ID:** ${employeeId}\n⏰ **Время:** ${time}\n\n_Сотрудник не зарегистрирован в базе данных._`;
                    sendTelegramMessage(warningMessage, { parse_mode: 'Markdown' });
                    return res.status(200).send('OK (Ignored, unknown employee)');
                }
                const eventDate = eventTimestamp.toISOString().split('T')[0];
                const name = empRows[0].fullName;

                // --- 1. Отправляем уведомление в Telegram при каждом событии ---
                const message = `${eventIcon} *${eventType === 'entry' ? 'Вход' : 'Выход'} сотрудника*\n\n🏢 **Офис:** ${officeName}\n🚪 **Дверь:** ${doorDescription}\n👤 **Сотрудник:** ${name}\n⏰ **Время:** ${time}`;
                sendTelegramMessage(message, { parse_mode: 'Markdown' });

                // --- 2. Применяем логику для записи в базу данных ---
                const [existingLogRows] = await pool.execute(
                    'SELECT id, checkin FROM attendance_logs WHERE employeeId = ? AND DATE(IFNULL(checkin, checkout)) = ?',
                    [employeeId, eventDate]
                );
                const existingLog = existingLogRows.length > 0 ? existingLogRows[0] : null;

                if (eventType === 'entry') {
                    // Записываем в базу только ПЕРВЫЙ вход за день
                    if (!existingLog || !existingLog.checkin) {
                        if (existingLog) {
                            // Если запись за этот день уже есть (например, был только выход), обновляем ее
                            await pool.execute(
                                'UPDATE attendance_logs SET checkin = ? WHERE id = ?',
                                [eventTimestamp, existingLog.id]
                            );
                        } else {
                            // Если записи за этот день нет, создаем новую
                            await pool.execute(
                                'INSERT INTO attendance_logs (employeeId, checkin) VALUES (?, ?)',
                                [employeeId, eventTimestamp]
                            );
                        }
                    }
                    // Если checkin уже есть, ничего не делаем с базой

                } else { // eventType === 'exit'
                    // Всегда обновляем или вставляем время выхода, чтобы сохранить ПОСЛЕДНИЙ выход
                    if (existingLog) {
                        await pool.execute(
                            'UPDATE attendance_logs SET checkout = ? WHERE id = ?',
                            [eventTimestamp, existingLog.id]
                        );
                    } else {
                        await pool.execute(
                            'INSERT INTO attendance_logs (employeeId, checkout) VALUES (?, ?)',
                            [employeeId, eventTimestamp]
                        );
                    }
                }
                
                return res.status(200).send('OK (Access Event Handled)');
            } else {
                // console.log("Event has no employeeId. Ignoring.");
                res.status(200).send('OK (System Event, no employeeId)');
            }
            
        } catch (error) {
            console.error("--- [!!! CRITICAL ERROR IN EVENT HANDLER !!!] ---");
            console.error(error);
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
            
            // ПРОВЕРКА НА УНИКАЛЬНОСТЬ
            const [existing] = await pool.execute(
                'SELECT id FROM employees WHERE fullName = ? OR email = ? OR phoneNumber = ?',
                [fullName, email, phoneNumber]
            );

            if (existing.length > 0) {
                return res.status(409).json({ error: 'Сотрудник с таким ФИО, Email или телефоном уже существует.' });
            }

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
            
            // ПРОВЕРКА НА УНИКАЛЬНОСТЬ (кроме текущего пользователя)
            const [existing] = await pool.execute(
                'SELECT id FROM employees WHERE (fullName = ? OR email = ? OR phoneNumber = ?) AND id != ?',
                [fullName, email, phoneNumber, id]
            );

            if (existing.length > 0) {
                return res.status(409).json({ error: 'Сотрудник с таким ФИО, Email или телефоном уже существует.' });
            }

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
            const { companyId } = req.query;

            let sql = `
                SELECT 
                    e.id, e.fullName, e.position, c.name AS companyName, e.phoneNumber, e.photoUrl, e.status, e.dateOfBirth, e.companyId
                FROM employees e
                LEFT JOIN companies c ON e.companyId = c.id
            `;
            const params = [];

            if (companyId) {
                sql += ' WHERE e.companyId = ?';
                params.push(companyId);
            }

            sql += ' ORDER BY e.fullName';
            
            const [rows] = await pool.query(sql, params);
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
                    e.id AS employeeId, e.fullName, DATE_FORMAT(al.checkin, '%Y-%m-%d') as date,
                    TIME(al.checkin) as firstEntry,
                    TIME(al.checkout) as lastExit
                FROM attendance_logs al
                JOIN employees e ON e.id = al.employeeId
                WHERE DATE(al.checkin) BETWEEN ? AND ?
            `;
            const params = [startDate, endDate];

            if (companyId) sql += ' AND e.companyId = ?', params.push(companyId);
            if (employeeId) sql += ' AND e.id = ?', params.push(employeeId);
            
            sql += ` ORDER BY date DESC, e.fullName`;

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
        sendTelegramMessage('🚀 **Финальный сервер v3 (MySQL)** запущен!', { parse_mode: 'Markdown' });
    });
}

// --- Запускаем все ---
main();
