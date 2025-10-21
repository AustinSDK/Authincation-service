# Tests

This directory contains tests for the Authentication Service.

## Running Tests

To run all tests:

```bash
npm test
```

## Test Files

### permissions.test.js

Tests the user permissions update functionality to ensure:
- Permissions are properly persisted to the database
- Updated permissions are immediately reflected in subsequent requests
- Error cases are handled appropriately
- Cache is properly invalidated after updates

Test cases include:
1. Direct database update and persistence verification
2. Handling updates to non-existent users
3. Multiple sequential updates
4. Empty permissions arrays
5. Large permissions arrays (100+ permissions)
6. Special characters in permission names

All tests use an isolated test database (`src/db/test.db`) that is cleaned up after each run.

## Test Coverage

The current test suite focuses on the permissions persistence bug fix, covering:
- Database persistence layer
- Permission update logic
- Error handling
- Edge cases

## Adding New Tests

To add new tests:
1. Create a new test file in this directory (e.g., `newfeature.test.js`)
2. Follow the pattern in `permissions.test.js`
3. Update `package.json` to include the new test in the test script
4. Document the tests in this README

## Test Database

Tests use a separate SQLite database located at `src/db/test.db`. This database is:
- Created fresh for each test run
- Automatically cleaned up after tests complete
- Isolated from the production database (`src/db/site.db`)
