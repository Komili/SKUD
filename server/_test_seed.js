// Cкрипт для наполнения БД тестовыми данными
// Использует библиотеку Faker.js для генерации реалистичных имен, дат и т.д.

const { fakerRU: faker } = require('@faker-js/faker');
const mysql = require('mysql2/promise');
const path = require('path');

// --- НАСТРОЙКИ ---
const NUM_EMPLOYEES_PER_COMPANY = 20; // Сколько сотрудников создать для КАЖДОЙ компании
const NUM_DAYS_ATTENDANCE = 90; // За сколько последних дней сгенерировать посещаемость

// --- Настройки MySQL (копируются из server.js) ---
const mysqlConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'skud',
    password: 'Favz050505',
    database: 'skud',
    charset: 'utf8mb4'
};

// --- Основная логика ---

// Функция для получения случайного элемента из массива
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 1. Создание компаний и отделов
async function seedCompaniesAndDepartments(pool) {
    console.log('--- Создание компаний и отделов ---');
    const companies = [
        { name: 'Фавз' },
        { name: 'Фавз-Климат' },
        { name: 'Макон' },
        { name: 'Калам' },
        { name: 'Роххои Фавз' },
        { name: 'Арматурный' }
    ];
    const departments = [
        { name: 'Администрация' },
        { name: 'Бухгалтерия' },
        { name: 'IT-отдел' },
        { name: 'Отдел продаж' },
        { name: 'Производство' },
        { name: 'Служба безопасности' }
    ];

    // Используем IGNORE чтобы не было ошибок при повторном запуске
    for (const company of companies) {
        await pool.execute('INSERT IGNORE INTO companies (name) VALUES (?)', [company.name]);
    }
    for (const department of departments) {
        await pool.execute('INSERT IGNORE INTO departments (name) VALUES (?)', [department.name]);
    }
    console.log('✅ Компании и отделы успешно созданы/проверены.');
    
    const [companyRows] = await pool.query('SELECT id FROM companies');
    const [departmentRows] = await pool.query('SELECT id FROM departments');

    return {
        companyIds: companyRows.map(r => r.id),
        departmentIds: departmentRows.map(r => r.id)
    };
}

// Списки таджикских имен
const tajikMaleNames = ['Фаррух', 'Рустам', 'Искандар', 'Бехруз', 'Алишер', 'Фирдавс', 'Хусрав', 'Мехроб', 'Сино', 'Сомон'];
const tajikFemaleNames = ['Манижа', 'Нигина', 'Шабнам', 'Фируза', 'Зарина', 'Мехрангез', 'Тахмина', 'Гуличон', 'Нозия', 'Мадина'];
const tajikLastNameBases = ['Рахмон', 'Саид', 'Карим', 'Назар', 'Мирзо', 'Али', 'Шариф', 'Хаким', 'Давлат', 'Султон'];


// 2. Создание сотрудников
async function seedEmployees(pool, { companyIds, departmentIds }) {
    const totalCompanies = companyIds.length;
    const totalEmployeesToCreate = totalCompanies * NUM_EMPLOYEES_PER_COMPANY;
    console.log(`\n--- Создание ${totalEmployeesToCreate} сотрудников (${NUM_EMPLOYEES_PER_COMPANY} в каждой из ${totalCompanies} компаний) ---`);
    
    const statuses = ['Активен', 'Активен', 'Активен', 'В отпуске', 'На больничном'];
    let createdCount = 0;

    for (const companyId of companyIds) {
        for (let i = 0; i < NUM_EMPLOYEES_PER_COMPANY; i++) {
            const isMale = Math.random() > 0.5;
            const firstName = isMale ? getRandom(tajikMaleNames) : getRandom(tajikFemaleNames);
            const lastNameBase = getRandom(tajikLastNameBases);
            const lastName = isMale ? `${lastNameBase}ов` : `${lastNameBase}ова`;
            const fullName = `${firstName} ${lastName}`;

            const employee = {
                fullName: fullName,
                position: faker.person.jobTitle(),
                phoneNumber: faker.phone.number(),
                email: faker.internet.email({ firstName, lastName }),
                photoUrl: '/uploads/placeholder.png', // Используем заглушку
                status: getRandom(statuses),
                dateOfBirth: faker.date.birthdate({ min: 18, max: 60, mode: 'age' }).toISOString().split('T')[0],
                hireDate: faker.date.past({ years: 5 }).toISOString().split('T')[0],
                companyId: companyId, // Присваиваем ID текущей компании
                departmentId: getRandom(departmentIds)
            };

            try {
                await pool.execute(
                    `INSERT INTO employees (fullName, position, phoneNumber, email, photoUrl, status, dateOfBirth, hireDate, companyId, departmentId) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    Object.values(employee)
                );
                createdCount++;
                process.stdout.write(`\r✅ Создан сотрудник ${createdCount}/${totalEmployeesToCreate}...`);
            } catch (error) {
                // Игнорируем ошибки дубликатов
                if (error.code !== 'ER_DUP_ENTRY') {
                    console.error(`\nОшибка при создании сотрудника ${fullName}:`, error.message);
                }
            }
        }
    }
    console.log('\n✅ Сотрудники успешно созданы.');
}

// 3. Создание записей о посещаемости
async function seedAttendance(pool) {
    console.log(`\n--- Генерация посещаемости за последние ${NUM_DAYS_ATTENDANCE} дней ---`);
    
    const [employees] = await pool.query('SELECT id FROM employees WHERE status != "Уволен"');
    if (employees.length === 0) {
        console.log('Нет активных сотрудников для генерации посещаемости.');
        return;
    }

    const today = new Date();
    for (let i = 0; i < NUM_DAYS_ATTENDANCE; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() - i);

        // Пропускаем выходные (суббота, воскресенье)
        if (currentDate.getDay() === 6 || currentDate.getDay() === 0) {
            continue;
        }

        for (const employee of employees) {
            // 85% шанс, что сотрудник был на работе
            if (Math.random() > 0.85) continue;

            const checkinHour = faker.number.int({ min: 8, max: 10 });
            const checkinMinute = faker.number.int({ min: 0, max: 59 });
            const checkin = new Date(currentDate);
            checkin.setHours(checkinHour, checkinMinute, faker.number.int({ min: 0, max: 59 }));

            const workDurationHours = faker.number.int({ min: 7, max: 9 });
            const checkout = new Date(checkin);
            checkout.setHours(checkin.getHours() + workDurationHours, faker.number.int({ min: 0, max: 59 }));

            try {
                await pool.execute(
                    'INSERT INTO attendance_logs (employeeId, checkin, checkout) VALUES (?, ?, ?)',
                    [employee.id, checkin, checkout]
                );
            } catch (error) {
                console.error(`\nОшибка при создании записи посещаемости для сотрудника ${employee.id}:`, error.message);
            }
        }
        process.stdout.write(`\r✅ Обработан день ${i + 1}/${NUM_DAYS_ATTENDANCE}...`);
    }
    console.log('\n✅ Записи о посещаемости успешно созданы.');
}


// --- Главная функция-исполнитель ---
async function run() {
    let pool;
    try {
        pool = mysql.createPool(mysqlConfig);
        console.log('Подключение к базе данных...');
        await pool.query('SELECT 1'); // Проверка соединения
        console.log('✅ Успешное подключение к MySQL.');

        const { companyIds, departmentIds } = await seedCompaniesAndDepartments(pool);
        
        if (!companyIds.length || !departmentIds.length) {
            console.error('❌ Критическая ошибка: Не удалось получить ID компаний или отделов. Дальнейшее выполнение невозможно.');
            return;
        }

        await seedEmployees(pool, { companyIds, departmentIds });
        await seedAttendance(pool);

        console.log('\n🎉 Все тестовые данные успешно сгенерированы!');

    } catch (error) {
        console.error('\n\n--- ❌ Произошла ошибка ---');
        console.error('Сообщение:', error.message);
        if (error.code) {
            console.error(`Код ошибки: ${error.code}`);
        }
        console.error('Убедитесь, что сервер MySQL запущен и настройки в mysqlConfig верны.');
    } finally {
        if (pool) {
            await pool.end();
            console.log('\nСоединение с базой данных закрыто.');
        }
    }
}

run();
