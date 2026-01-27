import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import inventoryRoutes from '../routes/inventory.js';
import jwt from 'jsonwebtoken';

// 1. Mock the database pool to prevent actual DB connections
vi.mock('../db.js', () => ({
    default: {
        query: vi.fn(),
    },
}));

import pool from '../db.js';

// 2. Setup a mini Express app for testing
const app = express();
app.use(express.json());
app.use('/api/inventory', inventoryRoutes);

// Use the secret defined in your vitest.config.js
const TEST_SECRET = 'your_test_secret_here';

// 3. Helper to create a valid Pharmacist JWT
const mockToken = jwt.sign(
    { id: 1, role: 'Pharmacist' },
    TEST_SECRET
);

describe('Inventory Route - Update Stock', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Reset mocks between tests to avoid interference
    });

    it('should return 403 if user is not a Pharmacist', async () => {
        // Sign a token with the correct secret but the WRONG role
        const patientToken = jwt.sign({ id: 2, role: 'Patient' }, TEST_SECRET);

        const res = await request(app)
            .post('/api/inventory/update')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ medicine_id: 1, quantity: 10, price: 15.00 });

        // Should bypass the 401 (invalid token) and hit the 403 (wrong role)
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Only pharmacists');
    });

    it('should correctly calculate "Low Stock" status when quantity < 5', async () => {
        // Mock first DB call: User lookup to return a valid pharmacy_id
        pool.query.mockResolvedValueOnce({
            rows: [{ pharmacy_id: 101 }]
        });

        // Mock second DB call: The actual insert/update query
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/inventory/update')
            .set('Authorization', `Bearer ${mockToken}`)
            .send({
                medicine_id: 5,
                quantity: 3, // Logic check: 3 is < 5, so status should be 'Low Stock'
                price: 20.00
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Low Stock');

        // Check if the DB was called with the correct calculated string 'Low Stock'
        const dbCalls = pool.query.mock.calls;
        const insertQueryArgs = dbCalls[1][1]; // Get arguments of the second query
        expect(insertQueryArgs[4]).toBe('Low Stock');
    });

    it('should return 404 if the pharmacist has no linked pharmacy', async () => {
        // Mock user lookup to return no rows (simulating a user not linked to a pharmacy)
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/inventory/update')
            .set('Authorization', `Bearer ${mockToken}`)
            .send({ medicine_id: 1, quantity: 10, price: 5.00 });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Pharmacy not found');
    });
});