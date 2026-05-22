const PASSWORD_COMPLEXITY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function validateNewPassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!PASSWORD_COMPLEXITY_RE.test(password)) {
    return 'Password must include uppercase, lowercase, and a number';
  }
  return null;
}

export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}
