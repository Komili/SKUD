import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Spinner, Alert, Button, Image, ListGroup } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmployeeModal from '../components/EmployeeModal';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

function EmployeeDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]); // Новое состояние для логов
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Даты для фильтра посещаемости
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
    const [endDate, setEndDate] = useState(new Date());

    const fetchEmployeeData = async () => {
        try {
            setError('');
            const employeeRes = await axios.get(`/api/employees/${id}`);
            setEmployee(employeeRes.data);
        } catch (err) {
            setError('Не удалось загрузить данные сотрудника. Возможно, он был удален.');
        }
    };
    
    const fetchAttendanceData = async () => {
        try {
            setLoading(true);
            const params = { 
                employeeId: id,
                startDate: startDate.toISOString().split('T')[0],
                endDate: (endDate || startDate).toISOString().split('T')[0]
            };
            const attendanceRes = await axios.get('/api/reports/attendance', { params });
            setAttendance(attendanceRes.data);
        } catch (err) {
             setError('Не удалось загрузить отчет о посещаемости.');
        } finally {
            setLoading(false);
        }
    }

    const fetchActivityLogs = async () => {
        try {
            const response = await axios.get(`/api/employees/${id}/activity`);
            setActivityLogs(response.data);
        } catch (err) {
            console.error("Не удалось загрузить последние активности.");
        }
    };

    useEffect(() => {
        fetchEmployeeData();
        fetchActivityLogs(); // Загружаем активности при монтировании
    }, [id]);
    
    useEffect(() => {
        if (startDate) {
            fetchAttendanceData();
        }
    }, [id, startDate, endDate]);

    const handleSaveEmployee = async (employeeData) => {
        try {
            await axios.put(`/api/employees/${employeeData.id}`, employeeData);
            setShowModal(false);
            fetchEmployeeData();
        } catch (error) {
            console.error("Ошибка при сохранении сотрудника:", error);
            setError("Не удалось сохранить данные. Проверьте, что Email уникален.");
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Вы уверены? Это действие необратимо.')) {
            try {
                await axios.delete(`/api/employees/${id}`);
                navigate('/employees');
            } catch (err) {
                setError('Не удалось удалить сотрудника.');
            }
        }
    };

    const calculateTotalHours = () => {
        return attendance.reduce((total, log) => {
            const hours = parseFloat(log.workedHours) || 0;
            return total + hours;
        }, 0).toFixed(2);
    };

    if (!employee && loading) {
        return <div className="text-center mt-5"><Spinner animation="border" /></div>;
    }
    if (error) {
        return <Alert variant="danger" className="mt-4">{error}</Alert>;
    }
    if (!employee) {
        return <p className="text-center mt-4">Сотрудник не найден.</p>;
    }

    return (
        <Container>
            <Button variant="light" onClick={() => navigate('/employees')} className="mb-3">
                &larr; К списку сотрудников
            </Button>
            <Row>
                <Col md={12} lg={5} className="mb-4">
                    <Card className="employee-detail-card mb-4">
                        <Card.Header as="h4" className="text-center">{employee.fullName}</Card.Header>
                        <Card.Body className="text-center">
                            <Image src={employee.photoUrl.startsWith('http') ? employee.photoUrl : `http://localhost:3001${employee.photoUrl}`} roundedCircle thumbnail className="mb-3" style={{width: '150px', height: '150px', objectFit: 'cover'}} />
                            <p><strong>Должность:</strong> {employee.position}</p>
                            <p><strong>Компания:</strong> {employee.companyName}</p>
                            <p><strong>Отдел:</strong> {employee.departmentName}</p>
                            <hr />
                            <p><strong>Телефон:</strong> {employee.phoneNumber}</p>
                            <p><strong>Email:</strong> {employee.email}</p>
                            <p><strong>Дата рождения:</strong> {new Date(employee.dateOfBirth).toLocaleDateString('ru-RU')}</p>
                            <p><strong>Дата приема:</strong> {new Date(employee.hireDate).toLocaleDateString('ru-RU')}</p>
                            <p><strong>Статус:</strong> {employee.status}</p>
                        </Card.Body>
                        <Card.Footer className="d-flex justify-content-between">
                            <Button variant="warning" onClick={() => setShowModal(true)}>Редактировать</Button>
                            <Button variant="danger" onClick={handleDelete}>Удалить</Button>
                        </Card.Footer>
                    </Card>

                    <Card>
                        <Card.Header as="h5">Последняя активность</Card.Header>
                        <ListGroup variant="flush">
                            {activityLogs.length > 0 ? activityLogs.map((log, index) => (
                                <ListGroup.Item key={index}>
                                    <span className={`fw-bold ${log.eventType === 'entry' ? 'text-success' : 'text-danger'}`}>
                                        {log.eventType === 'entry' ? 'Вход' : 'Выход'}
                                    </span>
                                    <span className="text-muted float-end">
                                        {new Date(log.timestamp).toLocaleString('ru-RU')}
                                    </span>
                                </ListGroup.Item>
                            )) : <ListGroup.Item>Нет данных об активности.</ListGroup.Item>}
                        </ListGroup>
                    </Card>
                </Col>
                <Col md={12} lg={7}>
                    <Row className="align-items-center mb-3">
                        <Col>
                            <h4>Посещаемость</h4>
                            {attendance.length > 0 && <p className="text-muted">Всего отработано: <strong>{calculateTotalHours()} ч.</strong></p>}
                        </Col>
                        <Col className="d-flex justify-content-end">
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
                            />
                        </Col>
                    </Row>
                    {loading ? <div className="text-center"><Spinner/></div> : 
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Первый вход</th>
                                <th>Последний выход</th>
                                <th>Отработано</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendance.length > 0 ? (
                                attendance.map((log, index) => (
                                    <tr key={index}>
                                        <td>{new Date(log.date).toLocaleDateString('ru-RU')}</td>
                                        <td>{log.firstEntry}</td>
                                        <td>{log.lastExit}</td>
                                        <td>{log.workedHours}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="text-center">Нет данных о посещаемости.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>}
                </Col>
            </Row>
            
            {employee && (
                <EmployeeModal
                    show={showModal}
                    onHide={() => setShowModal(false)}
                    employee={employee}
                    onSave={handleSaveEmployee}
                />
            )}
        </Container>
    );
}

export default EmployeeDetailPage;
