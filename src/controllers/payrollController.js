/**
 * POST /api/v1/payroll/approve
 * Accessible by Manager and SuperAdmin only.
 */
const approvePayroll = async (req, res, next) => {
  try {
    const { employeeId, amount, period } = req.body;

    if (!employeeId || !amount || !period) {
      return res.status(400).json({
        success: false,
        message: 'employeeId, amount, and period are required.',
      });
    }

    // In a real app this would write to a Payroll collection.
    // Simulated approval response for demonstration.
    return res.status(200).json({
      success: true,
      message: 'Payroll approved successfully.',
      data: {
        approvedBy: {
          id: req.user._id,
          name: req.user.name,
          role: req.user.role,
        },
        employeeId,
        amount,
        period,
        approvedAt: new Date().toISOString(),
        status: 'Approved',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/payroll
 * List all payroll records. Manager and SuperAdmin only.
 */
const getPayroll = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Payroll records retrieved.',
      data: [
        {
          id: 'pay_001',
          employeeId: 'emp_001',
          amount: 5000,
          period: 'October 2026',
          status: 'Approved',
        },
        {
          id: 'pay_002',
          employeeId: 'emp_002',
          amount: 4500,
          period: 'October 2026',
          status: 'Pending',
        },
      ],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { approvePayroll, getPayroll };
