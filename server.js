require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start the server
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  Enterprise Security Gateway                         ║
║  CSC337 - Lab Assignment 05                          ║
╠══════════════════════════════════════════════════════╣
║  Server  : http://localhost:${PORT}                     ║
║  Env     : ${process.env.NODE_ENV || 'development'}                           ║
║  Health  : http://localhost:${PORT}/health              ║
╚══════════════════════════════════════════════════════╝
    `);
  });

  // Handle unhandled promise rejections gracefully
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err.message);
    server.close(() => process.exit(1));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    process.exit(1);
  });
});
