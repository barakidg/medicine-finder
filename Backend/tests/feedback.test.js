import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import feedbackRoutes from '../routes/feedback.js';
import jwt from 'jsonwebtoken';

// 1. Mock DB
vi.mock('../db.js', () => ({
    default: {
        query: vi.fn(),
    },
}));

import pool from '../db.js';

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);

const TEST_SECRET = 'test123';

describe('Feedback Route - User Status Restrictions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should block a BANNED user from submitting feedback', async () => {
        const token = jwt.sign({ id: 99, role: 'Patient' }, TEST_SECRET);

        // Mock the DB check: return 'banned' for this user
        pool.query.mockResolvedValueOnce({
            rows: [{ status: 'banned' }]
        });

        const res = await request(app)
            .post('/api/feedback/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({
                pharmacy_id: 1,
                rating: 5,
                comment: "Great service!"
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Your account is banned.");

        // Ensure the INSERT query was NEVER called
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should allow an ACTIVE user to submit feedback', async () => {
        const token = jwt.sign({ id: 88, role: 'Patient' }, TEST_SECRET);

        // 1st Mock: User status check (active)
        pool.query.mockResolvedValueOnce({
            rows: [{ status: 'active' }]
        });
        // 2nd Mock: The Insert query
        pool.query.mockResolvedValueOnce({
            rows: [{ feedback_id: 1, comment: "Good" }]
        });

        const res = await request(app)
            .post('/api/feedback/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({
                pharmacy_id: 1,
                rating: 4,
                comment: "Good"
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe("Feedback submitted for moderation");
    });
});