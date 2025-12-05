require('dotenv').config();

const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const { port } = require('./lib/config');
const authRoutes = require('./routes/auth');
const viewRoutes = require('./routes/views');
const { initializeSocket } = require('./socket');

// Express app setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// View engine
app.set('view engine', 'ejs');
app.set('trust proxy', true);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (shared between Express and Socket.IO)
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// Routes
app.use('/', viewRoutes);
app.use('/', authRoutes);

// Static files
app.use(express.static('public'));

// Initialize WebSocket handlers
initializeSocket(io);

// Start server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
