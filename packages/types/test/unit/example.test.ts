// Example test to verify Vitest globals work without imports

describe('Vitest Configuration', () => {
  it('should have globals available without imports', () => {
    expect(true).toBe(true);
  });

  it('should support basic assertions', () => {
    const value = 42;
    expect(value).toBe(42);
    expect(value).toBeGreaterThan(0);
  });
});
