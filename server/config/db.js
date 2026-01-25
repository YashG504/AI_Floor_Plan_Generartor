const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.error('❌ MONGO_URI not set in .env file');
      isConnected = false;
      return false;
    }

    await mongoose.connect(mongoUri, {
      dbName: 'AiFloorPlan',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    });

    isConnected = true;
    console.log('✓ MongoDB Atlas Connected (Database: AiFloorPlan)');
    return true;
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    isConnected = false;
    return false;
  }
};

const getConnectionStatus = () => isConnected;

// Graceful shutdown
process.on('SIGINT', async () => {
  if (isConnected) {
    try {
      await mongoose.disconnect();
      console.log('✓ MongoDB disconnected on app termination');
    } catch (e) {
      console.error('Error disconnecting MongoDB:', e.message);
    }
  }
  process.exit(0);
});

module.exports = { connectDB, getConnectionStatus };
