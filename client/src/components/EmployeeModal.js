import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Alert } from 'react-bootstrap';
import axios from 'axios';
import DatePicker, { registerLocale } from 'react-datepicker';
import ru from 'date-fns/locale/ru';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('ru', ru);

function EmployeeModal({ show, onHide, employee, onSave, serverError }) {
    const [formData, setFormData] = useState({});
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const fetchDirectories = async () => {
            try {
                const [companiesRes, departmentsRes] = await Promise.all([
                    axios.get('/api/companies'),
                    axios.get('/api/departments')
                ]);
                setCompanies(companiesRes.data);
                setDepartments(departmentsRes.data);
            } catch (error) {
                console.error("Ошибка при загрузке справочников:", error);
            }
        };
        fetchDirectories();
    }, []);

    useEffect(() => {
        if (employee) {
            setFormData({ ...employee, dateOfBirth: employee.dateOfBirth || '', hireDate: employee.hireDate || '' });
        } else {
            setFormData({
                fullName: '', position: '', phoneNumber: '', email: '',
                hireDate: new Date().toISOString().split('T')[0], dateOfBirth: '',
                photoUrl: '/uploads/placeholder.png', status: 'Активен',
                companyId: '', departmentId: ''
            });
        }
        setSelectedFile(null);
        setErrors({});
    }, [employee, show]);

    const validate = () => {
        const newErrors = {};
        if (!formData.fullName) newErrors.fullName = 'Поле обязательно для заполнения.';
        if (!formData.position) newErrors.position = 'Поле обязательно для заполнения.';
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Введите корректный email.';
        if (!formData.phoneNumber) newErrors.phoneNumber = 'Поле обязательно для заполнения.';
        if (!formData.companyId) newErrors.companyId = 'Поле обязательно для заполнения.';
        if (!formData.departmentId) newErrors.departmentId = 'Поле обязательно для заполнения.';
        if (!formData.hireDate) newErrors.hireDate = 'Поле обязательно для заполнения.';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Поле обязательно для заполнения.';
        if (!employee && !selectedFile) newErrors.photo = 'Фото обязательно для нового сотрудника.';
        return newErrors;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleDateChange = (date, fieldName) => {
        setFormData(prev => ({ ...prev, [fieldName]: date ? date.toISOString().split('T')[0] : '' }));
        if (errors[fieldName]) {
            setErrors(prev => ({ ...prev, [fieldName]: null }));
        }
    };

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
        if (errors.photo) setErrors(prev => ({ ...prev, photo: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        // Создаем FormData для отправки данных, включая файл
        const finalData = new FormData();
        for (const key in formData) {
            finalData.append(key, formData[key]);
        }
        if (selectedFile) {
            finalData.append('photo', selectedFile);
        }

        onSave(finalData);
    };

    const cantSave = !employee && (companies.length === 0 || departments.length === 0);

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>{employee ? 'Редактировать' : 'Добавить'} сотрудника</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {serverError && <Alert variant="danger">{serverError}</Alert>}
                {cantSave && (
                    <Alert variant="warning">
                        Невозможно добавить сотрудника, так как в системе нет компаний или отделов. 
                        Пожалуйста, сначала создайте их в соответствующем разделе.
                    </Alert>
                )}
                <Form noValidate onSubmit={handleSubmit}>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>ФИО</Form.Label>
                            <Form.Control type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} isInvalid={!!errors.fullName} disabled={cantSave} />
                            <Form.Control.Feedback type="invalid">{errors.fullName}</Form.Control.Feedback>
                        </Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Должность</Form.Label>
                            <Form.Control type="text" name="position" value={formData.position || ''} onChange={handleChange} isInvalid={!!errors.position} disabled={cantSave} />
                            <Form.Control.Feedback type="invalid">{errors.position}</Form.Control.Feedback>
                        </Form.Group></Col>
                    </Row>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" name="email" value={formData.email || ''} onChange={handleChange} isInvalid={!!errors.email} disabled={cantSave} />
                            <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                        </Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Телефон</Form.Label>
                            <Form.Control type="tel" name="phoneNumber" value={formData.phoneNumber || ''} onChange={handleChange} isInvalid={!!errors.phoneNumber} disabled={cantSave} />
                            <Form.Control.Feedback type="invalid">{errors.phoneNumber}</Form.Control.Feedback>
                        </Form.Group></Col>
                    </Row>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Компания</Form.Label>
                            <Form.Select name="companyId" value={formData.companyId || ''} onChange={handleChange} isInvalid={!!errors.companyId} disabled={cantSave}>
                                <option value="">Выберите компанию...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">{errors.companyId}</Form.Control.Feedback>
                        </Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Отдел</Form.Label>
                            <Form.Select name="departmentId" value={formData.departmentId || ''} onChange={handleChange} isInvalid={!!errors.departmentId} disabled={cantSave}>
                                <option value="">Выберите отдел...</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">{errors.departmentId}</Form.Control.Feedback>
                        </Form.Group></Col>
                    </Row>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Дата приема</Form.Label>
                            <DatePicker
                                locale="ru"
                                selected={formData.hireDate ? new Date(formData.hireDate) : null}
                                onChange={(date) => handleDateChange(date, 'hireDate')}
                                className={`form-control ${errors.hireDate ? 'is-invalid' : ''}`}
                                dateFormat="dd.MM.yyyy"
                                placeholderText="дд.мм.гггг"
                                disabled={cantSave}
                            />
                            <Form.Control.Feedback type="invalid">{errors.hireDate}</Form.Control.Feedback>
                        </Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Дата рождения</Form.Label>
                            <DatePicker
                                locale="ru"
                                selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                                onChange={(date) => handleDateChange(date, 'dateOfBirth')}
                                className={`form-control ${errors.dateOfBirth ? 'is-invalid' : ''}`}
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                dateFormat="dd.MM.yyyy"
                                placeholderText="дд.мм.гггг"
                                disabled={cantSave}
                            />
                            <Form.Control.Feedback type="invalid">{errors.dateOfBirth}</Form.Control.Feedback>
                        </Form.Group></Col>
                    </Row>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Статус</Form.Label>
                            <Form.Select name="status" value={formData.status || 'Активен'} onChange={handleChange} disabled={cantSave}>
                                <option value="Активен">Активен</option>
                                <option value="В отпуске">В отпуске</option>
                                <option value="На больничном">На больничном</option>
                                <option value="Уволен">Уволен</option>
                            </Form.Select>
                        </Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3">
                            <Form.Label>Фото сотрудника</Form.Label>
                            <Form.Control type="file" onChange={handleFileChange} isInvalid={!!errors.photo} disabled={cantSave} />
                            <Form.Control.Feedback type="invalid">{errors.photo}</Form.Control.Feedback>
                        </Form.Group></Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Отмена</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={cantSave}>Сохранить</Button>
            </Modal.Footer>
        </Modal>
    );
}

export default EmployeeModal;
