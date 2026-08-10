/**
 * Test env bootstrap. db/pool.ts throws at import time without DATABASE_URL,
 * so give it a value before any app module loads. Integration tests only run
 * when TEST_DATABASE_URL points at a real (disposable) MySQL — CI provides a
 * mysql:8 service container; unit tests never touch the pool.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.DATABASE_URL ??= 'mysql://unit:unit@127.0.0.1:3306/unit_tests_never_connect';
}
