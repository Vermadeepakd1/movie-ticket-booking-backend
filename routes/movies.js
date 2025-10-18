// routes/movies.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// @route   POST api/movies
// @desc    Add a new movie (Admin only)
// @access  Private
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => { // 👈 UPDATE THIS
    // Now, only an admin can reach this point
    try {
        const { title, genre, duration_minutes, release_date, rating } = req.body;

        const newMovie = await pool.query(
            `INSERT INTO movies (title, genre, duration_minutes, release_date, rating)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [title, genre, duration_minutes, release_date, rating]
        );

        res.status(201).json(newMovie.rows[0]);
    } catch (err) {
        console.error('Error adding movie:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/movies
// @desc    Get all movies
// @access  Public
router.get('/', async (req, res) => {
    try {
        const allMovies = await pool.query('SELECT * FROM movies ORDER BY release_date DESC');
        res.json(allMovies.rows);
    } catch (err) {
        console.error('Error fetching movies:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;