import { createLogger } from '../../core/utils/logger';

const logger = createLogger();

export interface OutputOptions {
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
}

export class Output {
  private options: OutputOptions;

  constructor(options: OutputOptions = {}) {
    this.options = options;
  }

  info(message: string): void {
    if (this.options.quiet) return;
    if (this.options.json) {
      console.log(JSON.stringify({ level: 'info', message }));
    } else {
      console.log(`ℹ ${message}`);
    }
  }

  success(message: string): void {
    if (this.options.quiet) return;
    if (this.options.json) {
      console.log(JSON.stringify({ level: 'success', message }));
    } else {
      console.log(`✓ ${message}`);
    }
  }

  error(message: string, error?: Error): void {
    if (this.options.json) {
      console.error(JSON.stringify({ 
        level: 'error', 
        message,
        error: error?.message,
        stack: error?.stack
      }));
    } else {
      console.error(`✗ ${message}`);
      if (error && this.options.verbose) {
        console.error(`  ${error.message}`);
        if (error.stack) {
          console.error(error.stack);
        }
      }
    }
    logger.error(message, { error });
  }

  warning(message: string): void {
    if (this.options.quiet) return;
    if (this.options.json) {
      console.log(JSON.stringify({ level: 'warning', message }));
    } else {
      console.warn(`⚠ ${message}`);
    }
  }

  debug(message: string): void {
    if (!this.options.verbose) return;
    if (this.options.json) {
      console.log(JSON.stringify({ level: 'debug', message }));
    } else {
      console.log(`  ${message}`);
    }
  }

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  table(data: Array<Record<string, any>>, columns?: string[]): void {
    if (this.options.json) {
      this.json(data);
      return;
    }

    if (data.length === 0) {
      this.info('No data to display');
      return;
    }

    const cols = columns || Object.keys(data[0]);
    const colWidths = cols.map(col => {
      const headerWidth = col.length;
      const maxDataWidth = Math.max(
        ...data.map(row => String(row[col] || '').length)
      );
      return Math.max(headerWidth, maxDataWidth);
    });

    const separator = cols.map((_, i) => '-'.repeat(colWidths[i])).join(' | ');
    const header = cols.map((col, i) => col.padEnd(colWidths[i])).join(' | ');

    console.log(header);
    console.log(separator);

    data.forEach(row => {
      const line = cols.map((col, i) => 
        String(row[col] || '').padEnd(colWidths[i])
      ).join(' | ');
      console.log(line);
    });
  }

  list(items: string[], prefix: string = '•'): void {
    if (this.options.json) {
      this.json(items);
      return;
    }
    items.forEach(item => console.log(`  ${prefix} ${item}`));
  }

  newline(): void {
    if (!this.options.quiet) {
      console.log();
    }
  }

  progress(current: number, total: number, message?: string): void {
    if (this.options.quiet || this.options.json) return;
    
    const percentage = Math.round((current / total) * 100);
    const bar = this.createProgressBar(percentage);
    const msg = message ? ` ${message}` : '';
    process.stdout.write(`\r[${bar}] ${percentage}%${msg}`);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  private createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '='.repeat(filled) + ' '.repeat(empty);
  }
}

export function createOutput(options: OutputOptions = {}): Output {
  return new Output(options);
}
