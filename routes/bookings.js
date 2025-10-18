// routes/bookings.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware')

router.post('/', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const { show_id, show_seat_ids } = req.body;
        const user_id = req.user.id;

        if (!show_id || !show_seat_ids || !Array.isArray(show_seat_ids) || show_seat_ids.length === 0) {
            return res.status(400).json({ message: 'Show ID and an array of seat IDs are required.' });
        }

        await client.query('BEGIN');

        // 1. Check seat availability (same as before)
        const seatsResult = await client.query(
            `SELECT show_seat_id, status, price FROM showseats WHERE show_id = $1 AND show_seat_id = ANY($2::int[]) FOR UPDATE`,
            [show_id, show_seat_ids]
        );

        if (seatsResult.rows.length !== show_seat_ids.length) {
            throw new Error('One or more selected seats do not exist for this show.');
        }

        let totalAmount = 0;
        for (const seat of seatsResult.rows) {
            if (seat.status !== 'Available') {
                throw new Error(`Seat is no longer available.`);
            }
            totalAmount += parseFloat(seat.price);
        }

        // 2. Create the main booking record with 'Pending' status (same as before)
        const bookingResult = await client.query(
            "INSERT INTO bookings (user_id, show_id, total_amount, status) VALUES ($1, $2, $3, 'Pending') RETURNING booking_id",
            [user_id, show_id, totalAmount]
        );
        const newBookingId = bookingResult.rows[0].booking_id;

        // 3. (CORRECTED) Update seat status to 'Locked' AND create booking details
        for (const seatId of show_seat_ids) {
            // Lock the seat
            await client.query("UPDATE showseats SET status = 'Locked' WHERE show_seat_id = $1", [seatId]);
            // **THIS IS THE NEW LINE THAT FIXES THE BUG**
            await client.query("INSERT INTO bookingdetails (booking_id, show_seat_id) VALUES ($1, $2)", [newBookingId, seatId]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Booking created and seats locked. Please complete payment to confirm.',
            booking_id: newBookingId,
            total_amount: totalAmount
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Booking Error:', err.message);
        res.status(500).json({ message: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});


// @route   POST api/bookings/:id/confirm
// @desc    Confirm a booking after "payment"
// @access  Private
router.post('/:id/confirm', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id: booking_id } = req.params;
        const user_id = req.user.id;
        const { payment_method } = req.body; // e.g., "Credit Card"

        await client.query('BEGIN');

        // 1. Find the booking, ensure it belongs to the user and is 'Pending'
        const bookingResult = await client.query(
            "SELECT * FROM bookings WHERE booking_id = $1 AND user_id = $2 FOR UPDATE",
            [booking_id, user_id]
        );

        if (bookingResult.rows.length === 0) {
            throw new Error('Pending booking not found or you do not have permission to confirm it.');
        }
        const booking = bookingResult.rows[0];
        if (booking.status !== 'Pending') {
            throw new Error('This booking is not pending and cannot be confirmed.');
        }

        // 2. Update booking status to 'Confirmed'
        await client.query(
            "UPDATE bookings SET status = 'Confirmed' WHERE booking_id = $1",
            [booking_id]
        );

        // 3. Update the 'Locked' seats to 'Booked'
        await client.query(
            `UPDATE showseats SET status = 'Booked' WHERE show_seat_id IN (
                SELECT show_seat_id FROM bookingdetails WHERE booking_id = $1
            )`,
            [booking_id]
        );

        // 4. Create a payment record
        await client.query(
            "INSERT INTO payments (booking_id, amount, payment_method, payment_status) VALUES ($1, $2, $3, 'Completed')",
            [booking_id, booking.total_amount, payment_method || 'Card']
        );

        await client.query('COMMIT');

        res.json({ message: 'Payment successful and booking confirmed!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Confirmation Error:', err.message);
        res.status(400).json({ message: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});



// @route   GET api/bookings/my-bookings
// @desc    Get all bookings for the logged-in user, including seat numbers
// @access  Private
router.get('/my-bookings', authMiddleware, async (req, res) => {
    try {
        const user_id = req.user.id;

        const userBookings = await pool.query(
            `SELECT
                b.booking_id,
                b.booking_time,
                b.total_amount,
                b.status AS booking_status,
                m.title AS movie_title,
                t.name AS theater_name,
                s.show_time,
                ARRAY_AGG(st.seat_number) AS seats
            FROM bookings b
            JOIN shows s ON b.show_id = s.show_id
            JOIN movies m ON s.movie_id = m.movie_id
            JOIN theaters t ON s.theater_id = t.theater_id
            LEFT JOIN bookingdetails bd ON b.booking_id = bd.booking_id
            LEFT JOIN showseats ss ON bd.show_seat_id = ss.show_seat_id
            LEFT JOIN seats st ON ss.seat_id = st.seat_id
            WHERE b.user_id = $1
            GROUP BY b.booking_id, m.title, t.name, s.show_time
            ORDER BY s.show_time DESC`,
            [user_id]
        );

        res.json(userBookings.rows);
    } catch (err) {
        console.error('Error fetching user bookings:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;


// @route   PUT api/bookings/:id/cancel
// @desc    Cancel a booking (User only)
// @access  Private
router.put('/:id/cancel', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id: booking_id } = req.params;
        const user_id = req.user.id;

        // ---- Start Transaction ----
        await client.query('BEGIN');

        // 1. Find the booking and verify the owner
        const bookingResult = await client.query(
            'SELECT * FROM bookings WHERE booking_id = $1',
            [booking_id]
        );

        if (bookingResult.rows.length === 0) {
            throw new Error('Booking not found.');
        }

        const booking = bookingResult.rows[0];
        if (booking.user_id !== user_id) {
            throw new Error('Forbidden: You can only cancel your own bookings.');
        }
        if (booking.status === 'Cancelled') {
            throw new Error('This booking has already been cancelled.');
        }

        // 2. Update the booking status to 'Cancelled'
        await client.query(
            "UPDATE bookings SET status = 'Cancelled' WHERE booking_id = $1",
            [booking_id]
        );

        // 3. Find all show seats linked to this booking and set them back to 'Available'
        await client.query(
            `UPDATE showseats 
             SET status = 'Available' 
             WHERE show_seat_id IN (
                SELECT show_seat_id FROM bookingdetails WHERE booking_id = $1
             )`,
            [booking_id]
        );

        // 4. Commit the transaction
        await client.query('COMMIT');
        // ---- End Transaction ----

        res.json({ message: 'Booking cancelled successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Cancellation Error:', err.message);
        // Custom error handling for user-facing messages
        if (err.message.startsWith('Forbidden') || err.message.startsWith('Booking')) {
            return res.status(403).json({ message: err.message });
        }
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// @route   GET api/bookings
// @desc    Get a list of all bookings (Admin only)
// @access  Private (Admin)
router.get('/', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const allBookings = await pool.query(
            `SELECT
                b.booking_id, b.total_amount, b.status, b.booking_time,
                u.name as user_name, u.email as user_email,
                m.title as movie_title,
                s.show_time
            FROM bookings b
            JOIN users u ON b.user_id = u.user_id
            JOIN shows s ON b.show_id = s.show_id
            JOIN movies m ON s.movie_id = m.movie_id
            ORDER BY b.booking_time DESC`
        );
        res.json(allBookings.rows);
    } catch (err) {
        console.error('Error fetching all bookings:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/bookings/:id
// @desc    Get details of a single booking, including seats (Admin only)
// @access  Private (Admin)
router.get('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { id: booking_id } = req.params;

        // First, get the main booking details
        const bookingDetails = await pool.query(
            `SELECT
                b.booking_id, b.total_amount, b.status, b.booking_time,
                u.name as user_name, u.email as user_email,
                m.title as movie_title,
                t.name as theater_name,
                s.show_time
            FROM bookings b
            JOIN users u ON b.user_id = u.user_id
            JOIN shows s ON b.show_id = s.show_id
            JOIN movies m ON s.movie_id = m.movie_id
            JOIN theaters t ON s.theater_id = t.theater_id
            WHERE b.booking_id = $1`,
            [booking_id]
        );

        if (bookingDetails.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Next, get the specific seats for this booking
        const seatDetails = await pool.query(
            `SELECT s.seat_number, s.seat_type
             FROM bookingdetails bd
             JOIN showseats ss ON bd.show_seat_id = ss.show_seat_id
             JOIN seats s ON ss.seat_id = s.seat_id
             WHERE bd.booking_id = $1`,
            [booking_id]
        );

        const response = {
            ...bookingDetails.rows[0],
            seats: seatDetails.rows
        };

        res.json(response);

    } catch (err) {
        console.error('Error fetching single booking:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;