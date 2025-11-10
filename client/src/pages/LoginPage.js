import React, { useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function LoginPage({ onLogin }) {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await axios.post('/api/auth/login', { username, password });
            if (response.data.success) {
                onLogin();
                navigate('/');
            }
        } catch (err) {
            console.log(err);
            setError(err.response?.data?.message || t('loginError'));
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h2 className="text-center mb-4">{t('welcomeMessage')}</h2>
                <p className="text-center text-muted mb-4">
                    {t('loginPrompt')}
                </p>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>{t('usernameLabel')}</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder={t('usernamePlaceholder')}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>{t('passwordLabel')}</Form.Label>
                        <Form.Control
                            type="password"
                            placeholder={t('passwordPlaceholder')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </Form.Group>
                    
                    {error && <Alert variant="danger">{error}</Alert>}

                    <div className="d-grid">
                        <Button variant="primary" type="submit" size="lg">
                            {t('loginButton')}
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
}

export default LoginPage;
