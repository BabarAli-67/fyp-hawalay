/**
 * @param {string[]} keys
 * @throws {Error} if any key is missing or blank in process.env
 */
function validateEnv(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('validateEnv(keys): keys must be a non-empty array of strings');
  }
  const missing = keys.filter((key) => {
    const v = process.env[key];
    return v === undefined || String(v).trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(`Missing or empty required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { validateEnv };
