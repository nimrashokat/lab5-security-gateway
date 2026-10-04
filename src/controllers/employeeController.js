const User = require('../models/User');

/**
 * GET /api/v1/employee/profile
 * Accessible by ALL authenticated roles (SuperAdmin, Manager, Employee).
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
        isOAuthUser: user.isOAuthUser,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/employee/profile
 * Update own profile (name, department). All authenticated roles.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, department } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { name, department },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };
