import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server.js';

// 1. Mock the database pool
vi.mock('../db.js', () => ({
    default: {
        query: vi.fn(),
        connect: vi.fn(() => ({
            query: vi.fn(),
            release: vi.fn(),
        })),
    },
}));

import pool from '../db.js';

const TEST_SECRET = 'test123';

describe('Server.js Integration & Admin Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have CORS and JSON middleware enabled', async () => {
        const res = await request(app).get('/api/admin/pharmacies');
        // Even if unauthorized, receiving a JSON response proves middleware is active
        expect(res.headers['content-type']).toMatch(/json/);
    });

    it('should block non-Admin users from Admin routes', async () => {
        const patientToken = jwt.sign({ id: 1, role: 'Patient' }, TEST_SECRET);

        const res = await request(app)
            .get('/api/admin/pharmacies')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Insufficient permissions");
    });

    it('should allow Admin to fetch pharmacies for verification', async () => {
        const adminToken = jwt.sign({ id: 99, role: 'Admin' }, TEST_SECRET);

        pool.query.mockResolvedValueOnce({
            rows: [{ pharmacy_id: 1, name: 'Test Pharma', verified: false }]
        });

        const res = await request(app)
            .get('/api/admin/pharmacies')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body[0].name).toBe('Test Pharma');
    });

    it('should correctly calculate average ratings in the pharmacist feedback route', async () => {
        const pharmacistToken = jwt.sign({ id: 10, role: 'Pharmacist' }, TEST_SECRET);

        // Mock the sequence of queries in /api/pharmacist/feedback
        // 1. Get pharmacy_id for user
        pool.query.mockResolvedValueOnce({ rows: [{ pharmacy_id: 1 }] });
        // 2. Get pharmacy details
        pool.query.mockResolvedValueOnce({ rows: [{ name: 'HealthyCo', address: '123 St', status: 'active' }] });
        // 3. Get feedback list
        pool.query.mockResolvedValueOnce({ rows: [{ full_name: 'John Doe', comment: 'Great!' }] });
        // 4. Get average rating and total reviews
        pool.query.mockResolvedValueOnce({
            rows: [{ avg_rating: "4.5000", total_reviews: "10" }]
        });

        const res = await request(app)
            .get('/api/pharmacist/feedback')
            .set('Authorization', `Bearer ${pharmacistToken}`);

        expect(res.status).toBe(200);
        expect(res.body.average_rating).toBe("4.5"); // Verifies .toFixed(1) logic
        expect(res.body.total_reviews).toBe(10);
        expect(res.body.pharmacy.name).toBe('HealthyCo');
    });

    it('should block banned users from logging in', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ email: 'banned@test.com', status: 'banned' }]
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'banned@test.com', password: 'password123' });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain("account has been banned");
    });

    it('should return 400 for login with non-existent user', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'missing@test.com', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("User not found");
    });
});