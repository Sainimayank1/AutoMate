// Loaded by vitest before any test file, so AppModule's env validation sees these values.
process.env.LOG_LEVEL = "silent";
process.env.JWT_ACCESS_SECRET = "test-access-secret-".padEnd(48, "x");
