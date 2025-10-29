import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, InputGroup, FormControl, Button, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmployeeModal from '../components/EmployeeModal'; // Импортируем модальное окно

function EmployeesPage({ selectedCompanyId }) {
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all_except_fired'); // Значение по умолчанию
    const navigate = useNavigate();

    // Состояния для модального окна
    const [showModal, setShowModal] = useState(false);
    const [modalError, setModalError] = useState('');

    const fetchEmployees = useCallback(async () => {
        try {
            setError('');
            setLoading(true);
            const params = { companyId: selectedCompanyId };
            const response = await axios.get('/api/employees', { params });
            setEmployees(response.data);
        } catch (err) {
            setError('Не удалось загрузить список сотрудников.');
        } finally {
            setLoading(false);
        }
    }, [selectedCompanyId]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    useEffect(() => {
        let data = employees;

        // Фильтрация по статусу
        if (statusFilter === 'all_except_fired') {
            data = data.filter(emp => emp.status !== 'Уволен');
        } else if (statusFilter !== 'all') {
            data = data.filter(emp => emp.status === statusFilter);
        }

        // Фильтрация по поисковому запросу
        if (searchTerm) {
            data = data.filter(emp =>
                emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredEmployees(data);
    }, [employees, searchTerm, statusFilter]);

    // --- Функции для модального окна ---
    const handleShowAddModal = () => {
        setModalError('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setModalError('');
    };

    const handleSaveEmployee = async (employeeFormData) => {
        try {
            setModalError('');
            // Создание нового сотрудника (логика редактирования удалена)
            await axios.post('/api/employees', employeeFormData);
            fetchEmployees(); // Обновляем список
            handleCloseModal();
        } catch (error) {
            console.error("Ошибка при сохранении сотрудника:", error);
            const message = error.response?.data?.error || "Не удалось сохранить данные. Проверьте введенные значения и попробуйте снова.";
            setModalError(message);
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Активен': return 'status-active';
            case 'В отпуске': return 'status-on-leave';
            case 'Уволен': return 'status-fired';
            default: return '';
        }
    };

    const renderContent = () => {
        if (loading) {
            return <div className="text-center mt-5"><Spinner animation="border" /></div>;
        }
        if (filteredEmployees.length === 0 && !error) {
            return <p className="text-center mt-4">Сотрудники не найдены.</p>;
        }
        return (
            <Row xs={1} md={2} lg={3} xl={4} className="g-4">
                {filteredEmployees.map((employee) => (
                    <Col key={employee.id}>
                        <Card 
                            className="h-100 employee-card text-center" 
                            onClick={() => navigate(`/employees/${employee.id}`)}
                        >
                            <Card.Img variant="top" src={employee.photoUrl.startsWith('http') ? employee.photoUrl : `http://localhost:3001${employee.photoUrl}`} className="p-3 rounded-circle" />
                            <Card.Body>
                                <Card.Title>{employee.fullName}</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted">{employee.position}</Card.Subtitle>
                                <hr />
                                <p className="mb-1 small"><strong>Компания:</strong> {employee.companyName}</p>
                                <p className="mb-1 small"><strong>Телефон:</strong> {employee.phoneNumber}</p>
                                <p className="mb-1 small"><strong>Дата рождения:</strong> {new Date(employee.dateOfBirth).toLocaleDateString('ru-RU')}</p>
                            </Card.Body>
                            <Card.Footer>
                                <span className={`status-badge ${getStatusClass(employee.status)}`}>
                                    {employee.status}
                                </span>
                            </Card.Footer>
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    };


    return (
        <Container fluid>
            <Row className="align-items-center mb-4">
                <Col md={8}>
                    <h2>Список сотрудников</h2>
                </Col>
                <Col md={4} className="text-md-end">
                    <Button variant="primary" onClick={handleShowAddModal}>
                        Добавить сотрудника
                    </Button>
                </Col>
            </Row>
            
            <Row className="mb-4">
                <Col md={8}>
                    <InputGroup>
                        <FormControl
                            placeholder="Поиск по имени..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col md={4}>
                    <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all_except_fired">Активные/В отпуске</option>
                        <option value="all">Все</option>
                        <option value="Активен">Активен</option>
                        <option value="В отпуске">В отпуске</option>
                        <option value="Уволен">Уволен</option>
                    </Form.Select>
                </Col>
            </Row>

            {error && <Alert variant="danger">{error}</Alert>}
            
            {renderContent()}

            <EmployeeModal 
                show={showModal}
                onHide={handleCloseModal}
                employee={null}
                onSave={handleSaveEmployee}
                serverError={modalError}
            />
        </Container>
    );
}

export default EmployeesPage;
