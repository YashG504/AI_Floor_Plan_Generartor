try {
  const routes = require('./routes/floorPlanRoutes');
  console.log('Routes loaded successfully');
} catch (error) {
  console.error('Error loading routes:', error);
}
