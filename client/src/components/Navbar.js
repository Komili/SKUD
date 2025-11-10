import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, NavDropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function AppNavbar({ onLogout, selectedCompanyId, setSelectedCompanyId }) {
    const { t, i18n } = useTranslation();
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await axios.get('/api/companies');
                setCompanies(res.data);
            } catch (error) {
                console.error(t('companyLoadError'), error);
            }
        };
        fetchCompanies();
    }, [t]);

    const selectedCompanyName = companies.find(c => c.id === parseInt(selectedCompanyId))?.name || t('allCompanies');

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

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
                            <Nav.Link>{t('dashboard')}</Nav.Link>
                        </LinkContainer>
                        <LinkContainer to="/attendance">
                            <Nav.Link>{t('reports')}</Nav.Link>
                        </LinkContainer>
                        <LinkContainer to="/employees">
                            <Nav.Link>{t('employees')}</Nav.Link>
                        </LinkContainer>
                    </Nav>
                    <Nav>
                        <NavDropdown title={selectedCompanyName} id="company-filter-dropdown">
                            <NavDropdown.Item onClick={() => setSelectedCompanyId('')}>
                                {t('allCompanies')}
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

                        <NavDropdown title={i18n.language.toUpperCase()} id="language-switcher-dropdown" className="ms-2">
                            <NavDropdown.Item onClick={() => changeLanguage('en')}>EN</NavDropdown.Item>
                            <NavDropdown.Item onClick={() => changeLanguage('ru')}>RU</NavDropdown.Item>
                        </NavDropdown>

                        <Button variant="outline-secondary" onClick={onLogout} className="ms-2">
                            {t('logout')}
                        </Button>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default AppNavbar;
