// routes/theaters.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// @route   POST api/theaters
// @desc    Add a new theater (Admin only)
// @access  Private (Admin)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { name, location } = req.body;

        if (!name || !location) {
            return res.status(400).json({ message: 'Name and location are required.' });
        }

        const newTheater = await pool.query(
            'INSERT INTO theaters (name, location) VALUES ($1, $2) RETURNING *',
            [name, location]
        );

        res.status(201).json(newTheater.rows[0]);
    } catch (err) {
        console.error('Error adding theater:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/theaters
// @desc    Get all theaters
// @access  Public
router.get('/', async (req, res) => {
    try {
        const allTheaters = await pool.query('SELECT * FROM theaters ORDER BY name');
        res.json(allTheaters.rows);
    } catch (err) {
        console.error('Error fetching theaters:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;