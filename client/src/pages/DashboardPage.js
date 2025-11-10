import React from 'react';
import { Container } from 'react-bootstrap';
import TodaysAttendance from '../components/TodaysAttendance';

function DashboardPage({ selectedCompanyId }) {
    return (
        <Container fluid>
            <TodaysAttendance selectedCompanyId={selectedCompanyId} />
        </Container>
    );
}

export default DashboardPage;