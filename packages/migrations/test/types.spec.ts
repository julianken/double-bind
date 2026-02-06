import { describe, it, expect } from 'vitest';
import { MigrationError } from '../src/types.js';

describe('MigrationError', () => {
  it('creates error with migration name and message', () => {
    const error = new MigrationError('001-initial-schema', new Error('Database locked'));

    expect(error.name).toBe('MigrationError');
    expect(error.migrationName).toBe('001-initial-schema');
    expect(error.message).toBe("Migration '001-initial-schema' failed: Database locked");
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('handles string cause', () => {
    const error = new MigrationError('002-add-daily-notes', 'Something went wrong');

    expect(error.message).toBe("Migration '002-add-daily-notes' failed: Something went wrong");
    expect(error.cause).toBe('Something went wrong');
  });

  it('handles non-Error object cause', () => {
    const error = new MigrationError('003-test', { code: 500 });

    expect(error.message).toBe("Migration '003-test' failed: [object Object]");
    expect(error.cause).toEqual({ code: 500 });
  });

  it('is an instance of Error', () => {
    const error = new MigrationError('test', 'cause');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MigrationError);
  });
});
