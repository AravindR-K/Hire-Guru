  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const dotenv = require('dotenv');
  const connectDB = require('./config/db');

  // Load env vars
  dotenv.config();

  // Connect to database
  connectDB();

  const app = express();

  // Middleware
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any vercel.app previews and production deployments
      if (origin.endsWith('.vercel.app') || origin.includes('vercel.app')) {
        return callback(null, true);
      }

      // Allow explicitly listed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Block everything else
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error(`CORS policy: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  // Serve static files from uploads folder (for resumes, etc)
  const path = require('path');
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/hr', require('./routes/hr'));
  app.use('/api/candidate', require('./routes/candidate'));
  app.use('/api/interview', require('./routes/interview'));
  // Keep backward compatibility for old student endpoints
  app.use('/api/student', require('./routes/candidate'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'QuizMaster Pro API is running' });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);

    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 5MB limit' });
      }
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Something went wrong!', error: err.message });
  });

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
