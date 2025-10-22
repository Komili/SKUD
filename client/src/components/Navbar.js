import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, NavDropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import axios from 'axios';

function AppNavbar({ onLogout, selectedCompanyId, setSelectedCompanyId }) {
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await axios.get('/api/companies');
                setCompanies(res.data);
            } catch (error) {
                console.error("Ошибка при загрузке компаний:", error);
            }
        };
        fetchCompanies();
    }, []);

    const selectedCompanyName = companies.find(c => c.id === parseInt(selectedCompanyId))?.name || "Все компании";

    return (
        <Navbar bg="light" variant="light" expand="lg" className="mb-4 shadow-sm">
            <Container fluid>
                <LinkContainer to="/">
                    <Navbar.Brand className="fw-bold">FAVZ-GROUP</Navbar.Brand>
                </LinkContainer>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <LinkContainer to="/">
                            <Nav.Link>Дашборд</Nav.Link>
                        </LinkContainer>
                        <LinkContainer to="/attendance">
                            <Nav.Link>Отчеты</Nav.Link>
                        </LinkContainer>
                        <LinkContainer to="/employees">
                            <Nav.Link>Сотрудники</Nav.Link>
                        </LinkContainer>
                    </Nav>
                    <Nav>
                        <NavDropdown title={selectedCompanyName} id="company-filter-dropdown">
                            <NavDropdown.Item onClick={() => setSelectedCompanyId('')}>
                                Все компании
                            </NavDropdown.Item>
                            <NavDropdown.Divider />
                            {companies.map(company => (
                                <NavDropdown.Item 
                                    key={company.id} 
                                    onClick={() => setSelectedCompanyId(company.id)}
                                    active={company.id === parseInt(selectedCompanyId)}
                                >
                                    {company.name}
                                </NavDropdown.Item>
                            ))}
                        </NavDropdown>
                        <Button variant="outline-secondary" onClick={onLogout} className="ms-2">
                            Выйти
                        </Button>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default AppNavbar;
