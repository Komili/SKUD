import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Импортируем страницы и компоненты
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage'; // Главная страница
import AttendancePage from './pages/AttendancePage'; // Страница отчетов
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import AppNavbar from './components/Navbar';
import Footer from './components/Footer'; // Импортируем футер

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    
    useEffect(() => {
        const loggedIn = sessionStorage.getItem('isAuthenticated');
        if (loggedIn) setIsAuthenticated(true);
        setLoading(false);
    }, []);

    const handleLogin = () => {
        setIsAuthenticated(true);
        sessionStorage.setItem('isAuthenticated', 'true');
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('isAuthenticated');
        setSelectedCompanyId('');
    };

    const PrivateWrapper = ({ children }) => isAuthenticated ? children : <Navigate to="/login" />;

    if (loading) {
        return <div className="d-flex justify-content-center align-items-center vh-100"><h5>Загрузка...</h5></div>;
    }

    return (
        <Router>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                {isAuthenticated && (
                    <AppNavbar 
                        onLogout={handleLogout} 
                        selectedCompanyId={selectedCompanyId}
                        setSelectedCompanyId={setSelectedCompanyId}
                    />
                )}
                <main className="container mt-4 mb-4" style={{ flex: 1 }}>
                    <Routes>
                        <Route 
                            path="/login" 
                            element={!isAuthenticated ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} 
                        />
                        
                        <Route path="/" element={<PrivateWrapper><DashboardPage selectedCompanyId={selectedCompanyId} /></PrivateWrapper>} />
                        <Route path="/attendance" element={<PrivateWrapper><AttendancePage selectedCompanyId={selectedCompanyId} /></PrivateWrapper>} />
                        <Route path="/employees" element={<PrivateWrapper><EmployeesPage selectedCompanyId={selectedCompanyId} /></PrivateWrapper>} />
                        <Route path="/employees/:id" element={<PrivateWrapper><EmployeeDetailPage /></PrivateWrapper>} />

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
                {isAuthenticated && <Footer />}
            </div>
        </Router>
    );
}

export default App;
