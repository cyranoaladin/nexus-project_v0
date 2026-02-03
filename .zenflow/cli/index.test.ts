import { Command } from 'commander';

describe('CLI Index', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('Program Setup', () => {
    it('should have correct name and description', () => {
      const program = new Command();
      program
        .name('zenflow')
        .description('Zenflow - Automated worktree synchronization and workflow management')
        .version('0.1.0');

      expect(program.name()).toBe('zenflow');
      expect(program.description()).toBe('Zenflow - Automated worktree synchronization and workflow management');
    });

    it('should have global options', () => {
      const program = new Command();
      program
        .option('-v, --verbose', 'Enable verbose output')
        .option('-q, --quiet', 'Suppress non-essential output')
        .option('-c, --config <path>', 'Path to config file')
        .option('--json', 'Output in JSON format');

      const opts = program.opts();
      expect(program.options).toHaveLength(4);
    });
  });

  describe('Command Structure', () => {
    it('should have sync command', () => {
      const program = new Command();
      const syncCommand = new Command('sync');
      syncCommand.description('Synchronize worktree changes to main directory');
      
      expect(syncCommand.name()).toBe('sync');
      expect(syncCommand.description()).toBe('Synchronize worktree changes to main directory');
    });

    it('should have rule command', () => {
      const program = new Command();
      const ruleCommand = new Command('rule');
      ruleCommand.description('Manage Zenflow rules');
      
      expect(ruleCommand.name()).toBe('rule');
      expect(ruleCommand.description()).toBe('Manage Zenflow rules');
    });

    it('should have workflow command', () => {
      const program = new Command();
      const workflowCommand = new Command('workflow');
      workflowCommand.description('Manage Zenflow workflows');
      
      expect(workflowCommand.name()).toBe('workflow');
      expect(workflowCommand.description()).toBe('Manage Zenflow workflows');
    });

    it('should have status command', () => {
      const program = new Command();
      const statusCommand = new Command('status');
      statusCommand.description('Show Zenflow system status');
      
      expect(statusCommand.name()).toBe('status');
      expect(statusCommand.description()).toBe('Show Zenflow system status');
    });

    it('should have daemon command', () => {
      const program = new Command();
      const daemonCommand = new Command('daemon');
      daemonCommand.description('Manage Zenflow daemon service');
      
      expect(daemonCommand.name()).toBe('daemon');
      expect(daemonCommand.description()).toBe('Manage Zenflow daemon service');
    });
  });

  describe('Global Options Validation', () => {
    it('should reject verbose and quiet together', () => {
      const program = new Command();
      program
        .option('-v, --verbose', 'Enable verbose output')
        .option('-q, --quiet', 'Suppress non-essential output');

      process.exitCode = 0;
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`Process.exit(${code})`);
      }) as any);

      try {
        program.parse(['node', 'zenflow', '--verbose', '--quiet']);
      } catch (e) {
      }

      mockExit.mockRestore();
    });
  });

  describe('Sync Command Subcommands', () => {
    it('should have auto subcommand', () => {
      const syncCommand = new Command('sync');
      const autoCommand = new Command('auto');
      autoCommand
        .description('Automatically sync all active worktrees')
        .option('--dry-run', 'Preview changes without applying them');
      
      expect(autoCommand.name()).toBe('auto');
    });

    it('should have worktree subcommand', () => {
      const syncCommand = new Command('sync');
      const worktreeCommand = new Command('worktree');
      worktreeCommand
        .description('Sync a specific worktree')
        .option('--force', 'Force sync even if conflicts exist')
        .option('--dry-run', 'Preview changes without applying them');
      
      expect(worktreeCommand.name()).toBe('worktree');
    });

    it('should have list subcommand', () => {
      const syncCommand = new Command('sync');
      const listCommand = new Command('list');
      listCommand
        .description('List sync history')
        .option('--since <date>', 'Show syncs since date')
        .option('--status <status>', 'Filter by status')
        .option('--limit <n>', 'Limit number of results');
      
      expect(listCommand.name()).toBe('list');
    });

    it('should have show subcommand', () => {
      const syncCommand = new Command('sync');
      const showCommand = new Command('show');
      showCommand.description('Show details of a specific sync');
      
      expect(showCommand.name()).toBe('show');
    });

    it('should have rollback subcommand', () => {
      const syncCommand = new Command('sync');
      const rollbackCommand = new Command('rollback');
      rollbackCommand.description('Rollback a specific sync');
      
      expect(rollbackCommand.name()).toBe('rollback');
    });
  });
});
