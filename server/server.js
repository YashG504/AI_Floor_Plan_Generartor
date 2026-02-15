const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const floorPlanRoutes = require('./routes/floorPlanRoutes');

dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', floorPlanRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Graceful shutdown — release port on exit so nodemon restarts cleanly
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });

// Auto-recover from EADDRINUSE: kill the old process and retry once
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use — attempting to free it...`);
    const { execSync } = require('child_process');
    try {
      // Find and kill the process using the port (Windows)
      const result = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8' });
      const pids = [...new Set(result.trim().split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => p !== '0'))];
      pids.forEach(pid => {
        try { execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' }); console.log(`Killed PID ${pid}`); } catch (e) { }
      });
      // Retry after a short delay
      setTimeout(() => {
        app.listen(PORT, () => console.log(`Server running on port ${PORT} (recovered)`));
      }, 1000);
    } catch (killErr) {
      console.error(`Could not free port ${PORT}. Close the other process manually.`);
      process.exit(1);
    }
  }
});
