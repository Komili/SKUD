import React, { useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function LoginPage({ onLogin }) {
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
            setError(err.response?.data?.message || 'Произошла ошибка при входе.');
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h2 className="text-center mb-4">Добро пожаловать!</h2>
                <p className="text-center text-muted mb-4">
                    Войдите в систему FAVZ-GROUP для управления персоналом и отчетами.
                </p>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Имя пользователя</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Введите имя пользователя"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Пароль</Form.Label>
                        <Form.Control
                            type="password"
                            placeholder="Пароль"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </Form.Group>
                    
                    {error && <Alert variant="danger">{error}</Alert>}

                    <div className="d-grid">
                        <Button variant="primary" type="submit" size="lg">
                            Войти
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
}

export default LoginPage;
