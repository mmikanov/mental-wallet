import { runMigrations } from './migrations';

describe('runMigrations', () => {
  it('should be a function that accepts a database argument', () => {
    expect(typeof runMigrations).toBe('function');
    expect(runMigrations.length).toBe(1);
  });

  it('should call execAsync on the provided database object', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
    };

    await runMigrations(mockDb as any);

    expect(mockDb.execAsync).toHaveBeenCalledTimes(1);
    const sql = mockDb.execAsync.mock.calls[0][0] as string;

    // Verify all expected tables are in the schema
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cards');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS controls');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS completions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS control_values');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS reminders');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS settings');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS crisis_resources');
  });

  it('should create indexes for performance-critical queries', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
    };

    await runMigrations(mockDb as any);

    const sql = mockDb.execAsync.mock.calls[0][0] as string;

    // Verify indexes exist
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_cards_archived');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_cards_stack_position');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_cards_category');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_controls_card');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_completions_card');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_completions_date');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_control_values_completion');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_reminders_card');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_reminders_active');
  });
});
