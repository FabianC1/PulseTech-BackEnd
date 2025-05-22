# PulseTech Backend

The PulseTech backend is a secure, RESTful API built with Node.js and Express to support the full-stack healthcare ecosystem. It enables real-time, role-based interactions between patients and doctors through structured data exchange across both web and mobile platforms.

## Features and Architecture

### Core Responsibilities
- Handle secure login and role assignment
- Manage appointments, prescriptions, messaging, and medical records
- Support time-sensitive operations like medication logging and reminders
- Deliver identical behavior across web and mobile clients

### Authentication
- `POST /login`: Validates credentials and returns:
  - Email
  - Role (`patient` or `doctor`)
  - User metadata
- Passwords securely hashed with **bcrypt.js**
- Cross-origin requests handled via **CORS**

### Appointments API
- `POST /create-appointment`: Patient requests a new appointment
- `GET /get-appointments`: Returns relevant appointments for user role
- `PATCH /mark-appointment-complete`: Doctor marks as completed

### Medication API
- `GET /get-medical-records`: Retrieves patient records and prescriptions
- `POST /prescribe-medication`: Doctor adds a new medication
- `POST /mark-medication-taken`: Patient logs a dose as taken
- `POST /mark-medication-missed`: Auto-logs a missed dose

### Messaging System
- `GET /get-contacts`: Returns linked users (e.g. doctor for a patient)
- `GET /get-messages`: Fetches message history between users
- `POST /send-message`: Sends a message, with optional record attachment

### Medical Records
- Data includes:
  - Diagnosis history
  - Lifestyle indicators (smoking, alcohol, activity)
  - Past medications
  - Placeholder for smartwatch data

### Time Simulation (Client-Side)
- Backend responds to all requests based on `timeToTake` fields
- Dose timers and scheduling logic are client-side but aligned with backend data
- Supports a hidden time simulation panel on mobile for development use

## Technologies Used

### Backend Stack
- **Node.js** – Server runtime
- **Express.js** – API routing and middleware
- **MongoDB** – Flexible, NoSQL document database
- **Mongoose** – Schema-based modeling for collections like users, medications, and messages
- **Bcrypt.js** – Secure password hashing
- **CORS & Dotenv** – Development support for cross-origin and environment management

### Data Flow and Parity
- RESTful architecture supports both:
  - **Vue.js Web Client**
  - **React Native Mobile App**
- API returns are consistent across platforms, ensuring synchronized UI behavior and data handling

## Custom Features

### Medication Logic and Auto-Tracking
- Medication data includes:
  - `timeToTake`
  - Frequency (e.g., every 12 hours)
- Logic determines:
  - When the “Mark as Taken” button is visible
  - When a dose should be auto-marked as missed (2-hour window logic)
- Backend logs timestamps for both taken and missed doses

### Notifications
- Backend exposes schedule data; actual notifications are handled via Expo on mobile
- Dose eligibility logic processed client-side for instant feedback and offline support

### Error Handling
- Invalid actions (e.g., unauthorized access, empty form fields) return appropriate status codes and messages
- Frontend alerts reflect backend responses using unified alert styling

## Getting Started

1. Clone the repository  
2. Create a `.env` file with the following:
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key

3. Install dependencies:  
`npm install`
4. Start the server:  
`npm run dev`

## Development Tools
- **VS Code** with REST and MongoDB extensions
- **Postman** for testing endpoints
- **Git** and **GitHub** for version control
- **MongoDB Atlas** or **local MongoDB** for database access

## Summary
The PulseTech backend is a scalable, secure, and modular system that powers the core functionality of a role-based healthcare platform. With well-structured APIs, consistent data flow, and integration-ready endpoints, it enables seamless user interactions across mobile and web — supporting real-time updates, medication adherence tracking, and intuitive patient-doctor communication.
