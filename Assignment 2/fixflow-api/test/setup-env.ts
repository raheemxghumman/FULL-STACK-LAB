// Runs before every test file (jest "setupFiles"). Test-only configuration: these values take
// precedence over any .env file, so the tests never depend on a developer's local secrets.
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else-0123456789';
process.env.JWT_EXPIRES_IN = '15m';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing in tests
process.env.SEED_FILE = 'data/__no_seed_file_in_tests__.json'; // build the seed in memory every time
process.env.LIFECYCLE_TRACE = process.env.LIFECYCLE_TRACE ?? 'false';
