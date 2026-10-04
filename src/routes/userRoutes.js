const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require('../controllers/userController');

const { protect, checkRole } = require('../middleware/auth');

// All routes below are SuperAdmin only

// GET    /api/v1/users
router.get('/', protect, checkRole(['SuperAdmin']), getAllUsers);

// GET    /api/v1/users/:id
router.get('/:id', protect, checkRole(['SuperAdmin']), getUserById);

// PUT    /api/v1/users/:id
router.put('/:id', protect, checkRole(['SuperAdmin']), updateUser);

// DELETE /api/v1/users/:id
router.delete('/:id', protect, checkRole(['SuperAdmin']), deleteUser);

module.exports = router;
