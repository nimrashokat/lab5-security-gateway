const User = require('../models/User');

/**
 * GET /api/v1/users
 * List all users. SuperAdmin only.
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password -refreshToken');
    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/users/:id
 * Get a specific user by ID. SuperAdmin only.
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/users/:id
 * Update a user's role or status. SuperAdmin only.
 */
const updateUser = async (req, res, next) => {
  try {
    const { role, isActive, department } = req.body;

    // Prevent SuperAdmin from accidentally demoting themselves
    if (req.params.id === req.user._id.toString() && role && role !== 'SuperAdmin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, isActive, department },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/users/:id
 * Permanently delete a user. SuperAdmin only.
 */
const deleteUser = async (req, res, next) => {
  try {
    // Prevent SuperAdmin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account.',
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `User ${user.email} deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllUsers, getUserById, updateUser, deleteUser };
