# Monitor E2E Tests

End-to-end tests for the Monitor application using Playwright.

## Running Tests

```bash
# Run all e2e tests
yarn nx e2e monitor-e2e

# Run in UI mode for debugging
yarn nx e2e monitor-e2e --ui

# Run specific test file
yarn nx e2e monitor-e2e --grep="smoke"

# Run in headed mode (see the browser)
yarn nx e2e monitor-e2e --headed
```

## Test Structure

- `src/smoke.spec.ts` - Critical smoke tests that verify basic app functionality
- More test files can be added as needed

## Prerequisites

The e2e tests will automatically:

- Start the backend server on port 3000
- Start the frontend dev server on port 4200
- Run tests against the running application
- Shut down servers after tests complete

## Configuration

Configuration is in `playwright.config.ts`:

- Base URL: `http://localhost:4200`
- Retries: 2 on CI, 0 locally
- Workers: 1 on CI, parallel locally
- Browsers: Chromium (can be extended)

## Writing Tests

Use the Page Object Model pattern for complex interactions:

```typescript
test('should do something', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Click me' })).toBeVisible();
});
```

## CI/CD Integration

Tests are wired into Nx's dependency graph and will:

- Run after the build step
- Use cached results when possible
- Report failures to CI systems
