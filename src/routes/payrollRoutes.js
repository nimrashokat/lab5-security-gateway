const express = require('express');
const router = express.Router();

const { approvePayroll, getPayroll } = require('../controllers/payrollController');
const { protect, checkRole } = require('../middleware/auth');

// GET  /api/v1/payroll         — Manager and SuperAdmin only
router.get(
  '/',
  protect,
  checkRole(['SuperAdmin', 'Manager']),
  getPayroll
);

// POST /api/v1/payroll/approve — Manager and SuperAdmin only
router.post(
  '/approve',
  protect,
  checkRole(['SuperAdmin', 'Manager']),
  approvePayroll
);

module.exports = router;
