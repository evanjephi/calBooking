const { validationResult } = require("express-validator");

/**
 * Express middleware that checks express-validator results.
 * Returns 400 with structured errors if validation fails.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
}

module.exports = validate;
