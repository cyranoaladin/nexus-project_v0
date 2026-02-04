import { createOutput, Output } from './output';

jest.mock('../../core/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('Output', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('createOutput', () => {
    it('should create an Output instance', () => {
      const output = createOutput();
      expect(output).toBeInstanceOf(Output);
    });

    it('should pass options to Output', () => {
      const output = createOutput({ verbose: true });
      expect(output).toBeInstanceOf(Output);
    });
  });

  describe('info', () => {
    it('should output info message', () => {
      const output = createOutput();
      output.info('Test message');
      expect(consoleSpy.log).toHaveBeenCalledWith('ℹ Test message');
    });

    it('should not output in quiet mode', () => {
      const output = createOutput({ quiet: true });
      output.info('Test message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should output JSON in json mode', () => {
      const output = createOutput({ json: true });
      output.info('Test message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        JSON.stringify({ level: 'info', message: 'Test message' })
      );
    });
  });

  describe('success', () => {
    it('should output success message', () => {
      const output = createOutput();
      output.success('Operation completed');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Operation completed');
    });

    it('should not output in quiet mode', () => {
      const output = createOutput({ quiet: true });
      output.success('Operation completed');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should output error message', () => {
      const output = createOutput();
      output.error('Something went wrong');
      expect(consoleSpy.error).toHaveBeenCalledWith('✗ Something went wrong');
    });

    it('should output error with details in verbose mode', () => {
      const output = createOutput({ verbose: true });
      const error = new Error('Detailed error');
      output.error('Something went wrong', error);
      expect(consoleSpy.error).toHaveBeenCalledWith('✗ Something went wrong');
      expect(consoleSpy.error).toHaveBeenCalledWith('  Detailed error');
    });

    it('should always output errors even in quiet mode', () => {
      const output = createOutput({ quiet: true });
      output.error('Critical error');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('warning', () => {
    it('should output warning message', () => {
      const output = createOutput();
      output.warning('This is a warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith('⚠ This is a warning');
    });

    it('should not output in quiet mode', () => {
      const output = createOutput({ quiet: true });
      output.warning('This is a warning');
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should not output in normal mode', () => {
      const output = createOutput();
      output.debug('Debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should output in verbose mode', () => {
      const output = createOutput({ verbose: true });
      output.debug('Debug message');
      expect(consoleSpy.log).toHaveBeenCalledWith('  Debug message');
    });
  });

  describe('json', () => {
    it('should output formatted JSON', () => {
      const output = createOutput();
      const data = { key: 'value', number: 42 };
      output.json(data);
      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });
  });

  describe('table', () => {
    it('should output table with data', () => {
      const output = createOutput();
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      output.table(data);
      expect(consoleSpy.log).toHaveBeenCalledTimes(4);
    });

    it('should output JSON in json mode', () => {
      const output = createOutput({ json: true });
      const data = [{ name: 'Alice' }];
      output.table(data);
      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it('should handle empty data', () => {
      const output = createOutput();
      output.table([]);
      expect(consoleSpy.log).toHaveBeenCalledWith('ℹ No data to display');
    });

    it('should use specified columns', () => {
      const output = createOutput();
      const data = [{ name: 'Alice', age: 30, city: 'NYC' }];
      output.table(data, ['name', 'age']);
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should output list items', () => {
      const output = createOutput();
      const items = ['Item 1', 'Item 2', 'Item 3'];
      output.list(items);
      expect(consoleSpy.log).toHaveBeenCalledTimes(3);
      expect(consoleSpy.log).toHaveBeenCalledWith('  • Item 1');
      expect(consoleSpy.log).toHaveBeenCalledWith('  • Item 2');
      expect(consoleSpy.log).toHaveBeenCalledWith('  • Item 3');
    });

    it('should use custom prefix', () => {
      const output = createOutput();
      const items = ['Item 1'];
      output.list(items, '-');
      expect(consoleSpy.log).toHaveBeenCalledWith('  - Item 1');
    });

    it('should output JSON in json mode', () => {
      const output = createOutput({ json: true });
      const items = ['Item 1'];
      output.list(items);
      expect(consoleSpy.log).toHaveBeenCalledWith(JSON.stringify(items, null, 2));
    });
  });

  describe('newline', () => {
    it('should output newline', () => {
      const output = createOutput();
      output.newline();
      expect(consoleSpy.log).toHaveBeenCalledWith();
    });

    it('should not output in quiet mode', () => {
      const output = createOutput({ quiet: true });
      output.newline();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('progress', () => {
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('should output progress bar', () => {
      const output = createOutput();
      output.progress(50, 100, 'Processing');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should output newline when complete', () => {
      const output = createOutput();
      output.progress(100, 100);
      expect(stdoutSpy).toHaveBeenCalledWith('\n');
    });

    it('should not output in quiet mode', () => {
      const output = createOutput({ quiet: true });
      output.progress(50, 100);
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should not output in json mode', () => {
      const output = createOutput({ json: true });
      output.progress(50, 100);
      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });
});
