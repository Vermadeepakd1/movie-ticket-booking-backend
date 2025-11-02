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

// @route   POST api/theaters/:id/layout
// @desc    Add a batch of seats to a theater layout (Admin only)
// @access  Private (Admin)
router.post('/:id/layout', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id: theater_id } = req.params;
    const { startRow, endRow, endCol, seat_type, startCol = 1 } = req.body;

    if (!startRow || !endRow || !endCol || !seat_type) {
        return res.status(400).json({
            message: 'startRow, endRow, endCol, and seat_type are required.'
        });
    }

    const queryValues = []; // Holds the actual values for the query
    const queryParams = []; // Holds the $1, $2, $3 placeholders
    let paramIndex = 1;

    try {
        const startCharCode = startRow.charCodeAt(0);
        const endCharCode = endRow.charCodeAt(0);

        // Nested loops to generate seat numbers
        for (let r = startCharCode; r <= endCharCode; r++) {
            const rowLetter = String.fromCharCode(r);
            for (let c = startCol; c <= endCol; c++) {
                const seatNumber = `${rowLetter}${c}`;

                // Add the placeholder group (e.g., "($1, $2, $3)")
                queryParams.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);

                // Add the actual values to the list
                queryValues.push(theater_id, seatNumber, seat_type);
            }
        }

        if (queryParams.length === 0) {
            return res.status(400).json({ message: 'No seats to add.' });
        }

        // Build the final bulk-insert query
        // "ON CONFLICT" prevents errors if a seat (e.g., "A1") already exists
        const queryText = `
            INSERT INTO seats (theater_id, seat_number, seat_type) 
            VALUES ${queryParams.join(', ')} 
            ON CONFLICT (theater_id, seat_number) DO NOTHING
            RETURNING *
        `;

        // Execute the single query
        const newSeats = await pool.query(queryText, queryValues);

        res.status(201).json({
            message: `Successfully added ${newSeats.rowCount} new seats.`,
            addedSeats: newSeats.rows
        });

    } catch (err) {
        // Handle case where startRow/endRow are invalid letters
        if (isNaN(startCharCode) || isNaN(endCharCode)) {
            return res.status(400).json({ message: 'Invalid row range. Please use single capital letters.' });
        }
        console.error('Error adding seat layout:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;