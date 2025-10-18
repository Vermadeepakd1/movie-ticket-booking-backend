// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Import the database connection pool

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // 1. Check if user already exists
        const user = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (user.rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // 2. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Insert the new user into the database
        const newUser = await pool.query(
            'INSERT INTO Users (name, email, phone, password) VALUES ($1, $2, $3, $4) RETURNING user_id, email',
            [name, email, phone, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully!', user: newUser.rows[0] });

    } catch (err) {
        console.error('Registration Error:', err.message);
        res.status(500).send('Server error');
    }
});

// User Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if the user exists
        const user = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // 2. Compare the provided password with the stored hashed password
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // 3. Generate a JWT token
        const payload = {
            user: {
                id: user.rows[0].user_id,
                email: user.rows[0].email,
                role: user.rows[0].role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Send the token back to the client (for web and mobile)
        res.json({ message: 'Login successful!', token });

    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;