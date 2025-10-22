import React from 'react';
import { Container } from 'react-bootstrap';

const Footer = () => {
    const footerStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(5px)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        color: '#333',
        padding: '1rem 0',
        marginTop: 'auto', // Прижимаем футер к низу
        width: '100%'
    };

    return (
        <footer style={footerStyle} className="text-center">
            <Container>
                <p className="mb-0">
                    <strong>HR-СКУД (FAVZ-GROUP)</strong> &copy; {new Date().getFullYear()}
                </p>
                <p className="mb-0">
                    Техническая поддержка: <a href="tel:+992935006626">+992 93-500-66-26</a>
                </p>
            </Container>
        </footer>
    );
};

export default Footer;
