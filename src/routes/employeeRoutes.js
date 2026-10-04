const express = require('express');
const router = express.Router();

const { getProfile, updateProfile } = require('../controllers/employeeController');
const { protect, checkRole } = require('../middleware/auth');

// All routes require authentication. All 3 roles are allowed.

// GET  /api/v1/employee/profile  — all authenticated roles
router.get(
  '/profile',
  protect,
  checkRole(['SuperAdmin', 'Manager', 'Employee']),
  getProfile
);

// PUT  /api/v1/employee/profile  — all authenticated roles
router.put(
  '/profile',
  protect,
  checkRole(['SuperAdmin', 'Manager', 'Employee']),
  updateProfile
);

module.exports = router;
