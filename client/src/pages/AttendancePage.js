import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, InputGroup, FormControl, Spinner, Alert, Dropdown, DropdownButton } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper function to format date to YYYY-MM-DD
const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
};

// UPDATED Helper to parse workedHours string "HH:MM" to total minutes
const parseWorkedHoursToMinutes = (hoursString) => {
    if (!hoursString || typeof hoursString !== 'string' || !hoursString.includes(':')) return 0;
    const parts = hoursString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return (hours * 60) + minutes;
};

// Helper to format total minutes back to a "H ч M мин" string
const formatMinutesToWorkedHours = (totalMinutes) => {
    if (totalMinutes === 0) return "0 ч 0 мин";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} ч ${minutes} мин`;
};


function AttendancePage({ selectedCompanyId }) {
    const [reportData, setReportData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    
    // По умолчанию показываем текущий месяц
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
    const [endDate, setEndDate] = useState(new Date());
    
    const navigate = useNavigate();

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const params = { 
                companyId: selectedCompanyId,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate || startDate)
            };
            const res = await axios.get('/api/reports/attendance', { params });
            setReportData(res.data);
        } catch (error) {
            console.error("Ошибка при загрузке отчета:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate) { // Запускаем загрузку только если есть начальная дата
            fetchReportData();
        }
    }, [selectedCompanyId, startDate, endDate]);

    useEffect(() => {
        let data = reportData;
        if (searchTerm) {
            data = data.filter(item =>
                item.fullName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredData(data);
    }, [reportData, searchTerm]);

    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(18);
        doc.text('Отчет о посещаемости', 14, 22);

        const head = [['№', 'Сотрудник', 'Дата', 'Первый вход', 'Последний выход', 'Отработано']];
        const body = filteredData.map((item, index) => [
            index + 1,
            item.fullName,
            new Date(item.date).toLocaleDateString('ru-RU'),
            item.firstEntry,
            item.lastExit,
            item.workedHours
        ]);

        autoTable(doc, {
            startY: 30,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: {
                fillColor: [22, 160, 133], // A clean, modern green
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            }
        });

        doc.save('attendance-report.pdf');
    };

    const exportXLS = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Посещаемость');

        // --- DATA PREPARATION ---
        const employeeData = filteredData.reduce((acc, item) => {
            if (!acc[item.fullName]) acc[item.fullName] = {};
            acc[item.fullName][item.date] = item;
            return acc;
        }, {});

        const datesInRange = [];
        let currentDate = new Date(startDate);
        const finalEndDate = new Date(endDate);
        while (currentDate <= finalEndDate) {
            datesInRange.push(formatDate(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // --- HEADERS ---
        const headerRow = ['№', 'ФИО Сотрудника'];
        datesInRange.forEach(date => headerRow.push(new Date(date).toLocaleDateString('ru-RU')));
        headerRow.push('Итого отработано');
        worksheet.addRow(headerRow);

        // --- DATA ROWS ---
        let rowNumber = 1;
        Object.keys(employeeData).sort().forEach(fullName => {
            const employeeRecordsByDate = employeeData[fullName];
            const row = [rowNumber++, fullName];
            let totalMinutes = 0;

            datesInRange.forEach(date => {
                const record = employeeRecordsByDate[date];
                if (record && record.firstEntry && record.lastExit) {
                    row.push(`${record.firstEntry} - ${record.lastExit}`);
                    totalMinutes += parseWorkedHoursToMinutes(record.workedHours);
                } else {
                    row.push('');
                }
            });

            row.push(formatMinutesToWorkedHours(totalMinutes));
            worksheet.addRow(row);
        });

        // --- STYLING ---
        const borderStyle = {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }, // Dark Blue
            alignment: { vertical: 'middle', horizontal: 'center' }
        };

        const totalColumnIndex = headerRow.length;

        worksheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                // Header Style
                if (rowNum === 1) {
                    cell.style = headerStyle;
                } else {
                    // Zebra striping for data rows
                    if (rowNum % 2 === 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // Light Grey
                    }
                }

                // Total Column Style
                if (colNum === totalColumnIndex && rowNum > 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // Light Blue
                    cell.font = { bold: true };
                }
                
                // Center align date columns
                if (rowNum > 1 && colNum > 2 && colNum < totalColumnIndex) {
                    cell.alignment = { horizontal: 'center' };
                }

                cell.border = borderStyle;
            });
        });
        
        // --- COLUMN WIDTHS ---
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                let columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 12 ? 12 : maxLength + 2;
        });
        
        // --- FREEZE PANES ---
        worksheet.views = [
            { state: 'frozen', xSplit: 2, ySplit: 1, topLeftCell: 'C2' }
        ];

        // --- FILE GENERATION & DOWNLOAD ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'attendance-report.xlsx');
    };

    return (
        <Container fluid>
            <Row className="align-items-center mb-4">
                <Col md={5} className="d-flex align-items-center">
                    <h2 className="mb-0">Отчет о посещаемости</h2>
                    <DropdownButton id="dropdown-basic-button" title="Экспорт" variant="primary" className="ms-3">
                        <Dropdown.Item onClick={exportPDF}>Экспорт в PDF</Dropdown.Item>
                        <Dropdown.Item onClick={exportXLS}>Экспорт в XLS</Dropdown.Item>
                    </DropdownButton>
                </Col>
                <Col md={3}>
                    <InputGroup>
                        <FormControl
                            placeholder="Поиск по имени..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col md={4} className="d-flex justify-content-end">
                     <DatePicker
                        selectsRange={true}
                        startDate={startDate}
                        endDate={endDate}
                        onChange={(update) => {
                            setStartDate(update[0]);
                            setEndDate(update[1]);
                        }}
                        isClearable={true}
                        className="form-control"
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Выберите диапазон дат"
                    />
                </Col>
            </Row>

            {loading ? (
                <div className="text-center mt-5"><Spinner animation="border" /></div>
            ) : filteredData.length > 0 ? (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>Сотрудник</th>
                            <th>Дата</th>
                            <th>Первый вход</th>
                            <th>Последний выход</th>
                            <th>Отработано</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item, index) => (
                            <tr key={`${item.employeeId}-${item.date}-${index}`}>
                                <td>
                                    <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/employees/${item.employeeId}`) }}>
                                        {item.fullName}
                                    </a>
                                </td>
                                <td>{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                                <td>{item.firstEntry}</td>
                                <td>{item.lastExit}</td>
                                <td>{item.workedHours}</td>
                            </tr>
                        ))
                    }
                    </tbody>
                </Table>
            ) : (
                <Alert variant="info">Нет данных за выбранный период.</Alert>
            )}
        </Container>
    );
}

export default AttendancePage;
