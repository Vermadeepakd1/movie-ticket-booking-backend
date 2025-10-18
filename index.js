// index.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const cron = require('node-cron');
require('dotenv').config(); // This loads the variables from .env

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('Movie Ticket Booking API is running!');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api/theaters', require('./routes/theaters'));
app.use('/api/shows', require('./routes/shows'));
app.use('/api/bookings', require('./routes/bookings'));




// --- Scheduled Job for Cleaning Up Expired Bookings ---
// This job runs every minute to check for pending bookings older than 10 minutes.
cron.schedule('* * * * *', async () => {
    console.log('Running scheduled job: Cleaning up expired pending bookings...');
    // Calculate the timestamp for 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Find all booking IDs that are 'Pending' and older than 10 minutes
        const expiredBookingsResult = await client.query(
            "SELECT booking_id FROM bookings WHERE status = 'Pending' AND booking_time < $1",
            [tenMinutesAgo]
        );

        if (expiredBookingsResult.rows.length > 0) {
            const expiredBookingIds = expiredBookingsResult.rows.map(b => b.booking_id);
            console.log(`Found expired bookings: ${expiredBookingIds.join(', ')}`);

            // 2. Release the seats associated with those bookings
            await client.query(
                `UPDATE showseats SET status = 'Available' WHERE show_seat_id IN (
                    SELECT show_seat_id FROM bookingdetails WHERE booking_id = ANY($1::int[])
                )`,
                [expiredBookingIds]
            );

            // 3. Cancel the expired bookings
            await client.query(
                "UPDATE bookings SET status = 'Cancelled' WHERE booking_id = ANY($1::int[])",
                [expiredBookingIds]
            );

            console.log(`✅ Cleaned up ${expiredBookingIds.length} expired bookings.`);
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error during scheduled cleanup:', err);
    } finally {
        client.release();
    }
});



app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});