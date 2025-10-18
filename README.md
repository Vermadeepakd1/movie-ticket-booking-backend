# Movie Ticket Booking System - Backend 🎬

This repository contains the backend for a full-stack movie ticket booking system. It's a robust REST API built with Node.js, Express, and PostgreSQL, designed to handle all core functionalities, including user authentication, show scheduling, and real-time seat booking with transactional integrity.

**Live API URL:** `https://movie-ticket-booking-backend-suae.onrender.com`

---
## ✨ Features

* **Role-Based Authentication**: Secure JWT-based authentication for both customers and admins, with hashed passwords using bcrypt.
* **Admin Dashboard**: Full CRUD (Create, Read, Update, Delete) capabilities for managing movies, theaters, and show schedules.
* **Transactional Booking System**: A real-world booking workflow where users select seats, create a pending booking, and confirm it via a mock payment.
* **Automated Seat Management**: The system automatically generates and manages seat availability for every new show.
* **Scheduled Job Automation**: A background cron job automatically cleans up expired pending bookings, releasing locked seats and ensuring system integrity.
* **User & Admin Dashboards**: Dedicated endpoints for users to view their booking history and for admins to monitor all system-wide bookings.

---
## 🛠️ Tech Stack

* **Backend**: Node.js, Express.js
* **Database**: PostgreSQL
* **Authentication**: JSON Web Tokens (JWT), bcrypt
* **Automation**: `node-cron` for scheduled tasks
* **Libraries**: `pg`, `jsonwebtoken`, `bcrypt`, `cors`, `dotenv`

---
## 🚀 Getting Started

To get a copy of the project up and running on your local machine, follow these steps.

### **Prerequisites**

* Node.js (v14 or higher)
* PostgreSQL

### **Installation & Setup**

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    
    cd your-repo-name
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Create a `.env` file** in the root directory and add your local PostgreSQL credentials:

    ```env
    DB_USER=postgres
    DB_HOST=localhost
    DB_DATABASE=movie_booking_db
    DB_PASSWORD=your_local_password
    DB_PORT=5432
    JWT_SECRET=your_super_secret_jwt_key
    PORT=5000
    ```

4.  **Set up the database:**
    * Create a new PostgreSQL database named `movie_booking_db`.
    * Run the final SQL script provided to create all tables and insert starter data.

5.  **Start the server:**
    ```sh
    npm start
    ```
    The server will start running at `http://localhost:5000`.

---
## 🔑 API Endpoint Documentation

All endpoints are relative to the base URL: `https://movie-ticket-booking-backend-suae.onrender.com`

### **Authentication (`/api/auth`)**

| Method | Endpoint      | Description             | Request Body Example                             |
| :----- | :------------ | :---------------------- | :----------------------------------------------- |
| `POST` | `/register`   | Registers a new user.   | `{"name": "...", "email": "...", "password": "..."}` |
| `POST` | `/login`      | Logs in a user/admin.   | `{"email": "...", "password": "..."}`            |

### **Admin-Only Routes (`[Admin]`)**

*(Requires admin-level JWT Bearer Token)*

| Method | Endpoint         | Description           | Request Body Example                               |
| :----- | :--------------- | :-------------------- | :------------------------------------------------- |
| `POST` | `/api/movies`    | Adds a new movie.     | `{"title": "Inception", "genre": "Sci-Fi", ...}`     |
| `POST` | `/api/theaters`  | Adds a new theater.   | `{"name": "CityPlex", "location": "..."}`           |
| `POST` | `/api/shows`     | Schedules a new show. | `{"movie_id": 1, "theater_id": 1, "show_time": "...", "price": 250}` |
| `GET`  | `/api/bookings`  | Gets all bookings.    | (None)                                             |
| `GET`  | `/api/bookings/:id`| Gets a single booking.| (None)                                             |

### **Public Routes (`[Public]`)**

*(No authentication required)*

| Method | Endpoint           | Description                       |
| :----- | :----------------- | :-------------------------------- |
| `GET`  | `/api/movies`      | Gets a list of all movies.        |
| `GET`  | `/api/theaters`    | Gets a list of all theaters.      |
| `GET`  | `/api/shows`       | Gets a list of all shows.         |
| `GET`  | `/api/shows/:id/seats`| Gets seat availability for a show.|

### **User-Only Routes (`[User]`)**

*(Requires customer-level JWT Bearer Token)*

| Method | Endpoint                  | Description                    | Request Body Example                              |
| :----- | :------------------------ | :----------------------------- | :------------------------------------------------ |
| `POST` | `/api/bookings`           | Creates a new pending booking. | `{"show_id": 1, "show_seat_ids": [1, 2]}`           |
| `POST` | `/api/bookings/:id/confirm` | Confirms a pending booking.    | `{"payment_method": "Card"}`                      |
| `GET`  | `/api/bookings/my-bookings`| Gets user's booking history.   | (None)                                            |
| `PUT`  | `/api/bookings/:id/cancel`| Cancels a booking.             | (None)                                            |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](https://github.com/your-username/your-repo-name/issues) if you want to contribute.

---

## 📝 License

This project is licensed under the MIT License. See the `LICENSE` file for details.