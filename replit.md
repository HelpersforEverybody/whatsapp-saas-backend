# WhatsApp SaaS Backend

## Overview
A Node.js/Express backend server for WhatsApp SaaS functionality. Currently set up with basic Express server and ready for development.

## Tech Stack
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **SMS/WhatsApp**: Twilio
- **Dev Tools**: Nodemon for auto-restart

## Project Structure
- `server.js` - Main Express server file
- `package.json` - Node.js dependencies and scripts
- `.env` - Environment variables (not created yet, add as needed)

## Current Setup
- Server runs on port 3000 (localhost)
- Nodemon watches for file changes and auto-restarts
- Basic health check route at GET /

## Running the Project
The server automatically starts with the "Backend Server" workflow. You can also run:
- `npm run dev` - Start with nodemon (auto-restart on changes)
- `npm start` - Start with node (no auto-restart)

## Environment Variables
Create a `.env` file with:
```
PORT=3000
MONGODB_URI=your_mongodb_connection_string
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

## Status
✅ Node.js environment configured
✅ Dependencies installed
✅ Server running and operational
