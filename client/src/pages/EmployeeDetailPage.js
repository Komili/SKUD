import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Spinner, Alert, Button, Image, ListGroup } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmployeeModal from '../components/EmployeeModal';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from 'react-i18next';

function EmployeeDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]); // Новое состояние для логов
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalError, setModalError] = useState(''); // Состояние для ошибки в модальном окне

    // Даты для фильтра посещаемости
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
    const [endDate, setEndDate] = useState(new Date());

    const fetchEmployeeData = useCallback(async () => {
        try {
            setError('');
            const employeeRes = await axios.get(`/api/employees/${id}`);
            setEmployee(employeeRes.data);
        } catch (err) {
            setError(t('employeeLoadErrorDetail'));
        }
    }, [id, t]);
    
    const fetchAttendanceData = useCallback(async () => {
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
             setError(t('attendanceLoadError'));
        } finally {
            setLoading(false);
        }
    }, [id, startDate, endDate, t]);

    const fetchActivityLogs = useCallback(async () => {
        try {
            const response = await axios.get(`/api/employees/${id}/activity`);
            setActivityLogs(response.data);
        } catch (err) {
            console.error(t('activityLoadError'));
        }
    }, [id, t]);

    useEffect(() => {
        fetchEmployeeData();
        fetchActivityLogs(); // Загружаем активности при монтировании
    }, [fetchEmployeeData, fetchActivityLogs]);
    
    useEffect(() => {
        if (startDate) {
            fetchAttendanceData();
        }
    }, [startDate, fetchAttendanceData]);

    const handleSaveEmployee = async (employeeData) => {
        try {
            setModalError(''); // Сбрасываем предыдущую ошибку
            // Так как employeeData это FormData, нам нужен id из состояния
            await axios.put(`/api/employees/${employee.id}`, employeeData);
            setShowModal(false); // Закрываем окно только при успехе
            fetchEmployeeData(); // Обновляем данные на странице
        } catch (error) {
            console.error(t('employeeSaveError'), error);
            const message = error.response?.data?.error || t('employeeSaveDefaultErrorDetail');
            setModalError(message); // Устанавливаем ошибку для модального окна
        }
    };

    const handleDelete = async () => {
        if (window.confirm(t('deleteConfirmation'))) {
            try {
                await axios.delete(`/api/employees/${id}`);
                navigate('/employees');
            } catch (err) {
                setError(t('deleteError'));
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
        return <p className="text-center mt-4">{t('employeeNotFound')}</p>;
    }

    return (
        <Container>
            <Button variant="light" onClick={() => navigate('/employees')} className="mb-3">
                &larr; {t('backToListButton')}
            </Button>
            <Row>
                <Col md={12} lg={5} className="mb-4">
                    <Card className="employee-detail-card mb-4">
                        <Card.Header as="h4" className="text-center">{employee.fullName}</Card.Header>
                        <Card.Body className="text-center">
                            <Image src={employee.photoUrl.startsWith('http') ? employee.photoUrl : `http://localhost:3001${employee.photoUrl}`} roundedCircle thumbnail className="mb-3" style={{width: '150px', height: '150px', objectFit: 'cover'}} />
                            <p><strong>{t('positionLabel')}:</strong> {employee.position}</p>
                            <p><strong>{t('companyLabel')}:</strong> {employee.companyName}</p>
                            <p><strong>{t('departmentLabel')}:</strong> {employee.departmentName}</p>
                            <hr />
                            <p><strong>{t('phoneLabel')}:</strong> {employee.phoneNumber}</p>
                            <p><strong>{t('emailLabel')}:</strong> {employee.email}</p>
                            <p><strong>{t('dateOfBirthLabel')}:</strong> {new Date(employee.dateOfBirth).toLocaleDateString('ru-RU')}</p>
                            <p><strong>{t('hireDateLabel')}:</strong> {new Date(employee.hireDate).toLocaleDateString('ru-RU')}</p>
                            <p><strong>{t('statusLabel')}:</strong> {t(employee.status)}</p>
                        </Card.Body>
                        <Card.Footer className="d-flex justify-content-between">
                            <Button variant="warning" onClick={() => setShowModal(true)}>{t('editButton')}</Button>
                            <Button variant="danger" onClick={handleDelete}>{t('deleteButton')}</Button>
                        </Card.Footer>
                    </Card>

                    <Card>
                        <Card.Header as="h5">{t('lastActivityHeader')}</Card.Header>
                        <ListGroup variant="flush">
                            {activityLogs.length > 0 ? activityLogs.map((log, index) => (
                                <ListGroup.Item key={index}>
                                    <span className={`fw-bold ${log.eventType === 'entry' ? 'text-success' : 'text-danger'}`}>
                                        {log.eventType === 'entry' ? t('entryLog') : t('exitLog')}
                                    </span>
                                    <span className="text-muted float-end">
                                        {new Date(log.timestamp).toLocaleString('ru-RU')}
                                    </span>
                                </ListGroup.Item>
                            )) : <ListGroup.Item>{t('noActivityData')}</ListGroup.Item>}
                        </ListGroup>
                    </Card>
                </Col>
                <Col md={12} lg={7}>
                    <Row className="align-items-center mb-3">
                        <Col>
                            <h4>{t('attendanceHeader')}</h4>
                            {attendance.length > 0 && <p className="text-muted">{t('totalWorkedHours')}: <strong>{calculateTotalHours()} {t('hoursUnit')}</strong></p>}
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
                                <th>{t('dateHeader')}</th>
                                <th>{t('firstCheckinHeader')}</th>
                                <th>{t('lastCheckoutHeader')}</th>
                                <th>{t('workedHoursHeader')}</th>
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
                                    <td colSpan="4" className="text-center">{t('noAttendanceData')}</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>}
                </Col>
            </Row>
            
            {employee && (
                <EmployeeModal
                    show={showModal}
                    onHide={() => {
                        setShowModal(false);
                        setModalError(''); // Сбрасываем ошибку при закрытии
                    }}
                    employee={employee}
                    onSave={handleSaveEmployee}
                    serverError={modalError}
                />
            )}
        </Container>
    );
}

export default EmployeeDetailPage;
