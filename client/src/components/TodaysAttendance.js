import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, InputGroup, FormControl, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function TodaysAttendance({ selectedCompanyId }) {
    const { t } = useTranslation();
    const [reportData, setReportData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchTodaysAttendance = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            const params = { 
                companyId: selectedCompanyId,
                startDate: today,
                endDate: today
            };
            const res = await axios.get('/api/reports/attendance', { params });
            // Показываем только тех, у кого есть запись о входе
            setReportData(res.data.filter(item => item.firstEntry !== 'N/A'));
        } catch (error) {
            console.error(t('reportLoadError'), error);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка данных при изменении фильтра компании
    useEffect(() => {
        fetchTodaysAttendance();
    }, [selectedCompanyId]);

    // Фильтрация по поиску
    useEffect(() => {
        let data = reportData;
        if (searchTerm) {
            data = data.filter(item =>
                item.fullName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredData(data);
    }, [reportData, searchTerm]);

    if (loading) {
        return <div className="text-center mt-5"><Spinner animation="border" /></div>;
    }

    return (
        <Container fluid>
            <Row className="align-items-center mb-4">
                <Col md={8}>
                    <h2>{t('todaysAttendanceTitle')} ({filteredData.length})</h2>
                </Col>
                <Col md={4}>
                    <InputGroup>
                        <FormControl
                            placeholder={t('searchByNamePlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
            </Row>

            {filteredData.length > 0 ? (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>{t('employeeHeader')}</th>
                            <th>{t('checkinHeader')}</th>
                            <th>{t('checkoutHeader')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item) => (
                            <tr key={item.employeeId}>
                                <td>
                                    <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/employees/${item.employeeId}`) }}>
                                        {item.fullName}
                                    </a>
                                </td>
                                <td>{item.firstEntry}</td>
                                <td>{item.lastExit}</td>
                            </tr>
                        ))
                    }
                    </tbody>
                </Table>
            ) : (
                <Alert variant="info">{t('noDataMessage')}</Alert>
            )}
        </Container>
    );
}

export default TodaysAttendance;