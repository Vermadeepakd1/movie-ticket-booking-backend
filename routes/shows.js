// routes/shows.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// @route   POST api/shows
// @desc    Schedule a new show and create its seat availability (Admin only)
// @access  Private (Admin)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
    // Get a client from the pool to run the transaction
    const client = await pool.connect();

    try {
        const { movie_id, theater_id, show_time, price } = req.body;

        if (!movie_id || !theater_id || !show_time || !price) {
            return res.status(400).json({ message: 'Movie, theater, show time, and price are required.' });
        }

        // ---- Start Transaction ----
        await client.query('BEGIN');

        // 1. Insert the new show and get its ID
        const newShowResult = await client.query(
            'INSERT INTO shows (movie_id, theater_id, show_time) VALUES ($1, $2, $3) RETURNING *',
            [movie_id, theater_id, show_time]
        );
        const newShow = newShowResult.rows[0];

        // 2. Find all seats associated with that theater
        const seatsResult = await client.query(
            'SELECT seat_id FROM seats WHERE theater_id = $1',
            [theater_id]
        );
        const seats = seatsResult.rows;

        if (seats.length === 0) {
            // If the theater has no seats, we should not create the show.
            throw new Error('This theater has no seats configured.');
        }

        // 3. For each seat, create an entry in the "showseats" table
        const showSeatPromises = seats.map(seat => {
            return client.query(
                'INSERT INTO showseats (show_id, seat_id, status, price) VALUES ($1, $2, $3, $4)',
                [newShow.show_id, seat.seat_id, 'Available', price]
            );
        });

        await Promise.all(showSeatPromises); // Wait for all seat insertions to complete

        // 4. If everything is successful, commit the transaction
        await client.query('COMMIT');
        // ---- End Transaction ----

        res.status(201).json({ message: 'Show created and seats initialized successfully!', show: newShow });

    } catch (err) {
        // If any step fails, roll back all changes
        await client.query('ROLLBACK');

        if (err.code === '23503') {
            return res.status(404).json({ message: 'Movie or Theater not found.' });
        }
        console.error('Error adding show:', err.message);
        res.status(500).send('Server Error');
    } finally {
        // VERY IMPORTANT: Always release the client back to the pool
        client.release();
    }
});

// @route   GET api/shows
// @desc    Get all scheduled shows with movie and theater details
// @access  Public
router.get('/', async (req, res) => {
    try {
        const allShows = await pool.query(`
            SELECT 
                s.show_id, 
                s.show_time, 
                m.title as movie_title, 
                m.duration_minutes,
                t.name as theater_name, 
                t.location as theater_location 
            FROM shows s
            JOIN movies m ON s.movie_id = m.movie_id
            JOIN theaters t ON s.theater_id = t.theater_id
            ORDER BY s.show_time;
        `);
        res.json(allShows.rows);
    } catch (err) {
        console.error('Error fetching shows:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/shows/:id/seats
// @desc    Get all seats and their availability for a specific show
// @access  Public
router.get('/:id/seats', async (req, res) => {
    try {
        const { id } = req.params; // This is the show_id

        const seatsResult = await pool.query(
            `SELECT 
                ss.show_seat_id,
                ss.status,
                ss.price,
                s.seat_number,
                s.seat_type
             FROM showseats ss
             JOIN seats s ON ss.seat_id = s.seat_id
             WHERE ss.show_id = $1
             ORDER BY s.seat_number`,
            [id]
        );

        if (seatsResult.rows.length === 0) {
            return res.status(404).json({ message: 'No seats found for this show, or the show does not exist.' });
        }

        res.json(seatsResult.rows);
    } catch (err) {
        console.error('Error fetching seat availability:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;