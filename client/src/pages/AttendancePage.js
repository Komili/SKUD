import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, InputGroup, FormControl, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

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
                startDate: startDate.toISOString().split('T')[0],
                // Если endDate не выбрана, используем startDate
                endDate: (endDate || startDate).toISOString().split('T')[0]
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

    return (
        <Container fluid>
            <Row className="align-items-center mb-4">
                <Col md={5}>
                    <h2>Отчет о посещаемости</h2>
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
