import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface RepoConfig {
  name: string;
  numWorktrees: number;
  filesPerWorktree: number;
  linesPerFile: number;
  basePath: string;
}

export class TestRepoGenerator {
  private config: RepoConfig;

  constructor(config: RepoConfig) {
    this.config = config;
  }

  async create(): Promise<string> {
    const repoPath = path.join(this.config.basePath, this.config.name);
    
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
    
    fs.mkdirSync(repoPath, { recursive: true });
    
    execSync('git init', { cwd: repoPath, stdio: 'pipe' });
    execSync('git config user.email "test@zenflow.local"', { cwd: repoPath, stdio: 'pipe' });
    execSync('git config user.name "Zenflow Test"', { cwd: repoPath, stdio: 'pipe' });
    
    const readmePath = path.join(repoPath, 'README.md');
    fs.writeFileSync(readmePath, '# Test Repository\n\nGenerated for Zenflow performance testing.\n');
    execSync('git add README.md', { cwd: repoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' });
    
    return repoPath;
  }

  async createWorktrees(repoPath: string): Promise<string[]> {
    const worktreePaths: string[] = [];
    
    for (let i = 0; i < this.config.numWorktrees; i++) {
      const branchName = `feature/test-branch-${i + 1}`;
      const worktreePath = path.join(this.config.basePath, `worktree-${i + 1}`);
      
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      }
      
      execSync(`git worktree add -b ${branchName} ${worktreePath}`, { 
        cwd: repoPath, 
        stdio: 'pipe' 
      });
      
      worktreePaths.push(worktreePath);
    }
    
    return worktreePaths;
  }

  async populateWorktree(worktreePath: string, changeType: 'small' | 'medium' | 'large'): Promise<void> {
    let numFiles: number;
    
    switch (changeType) {
      case 'small':
        numFiles = Math.min(this.config.filesPerWorktree, 10);
        break;
      case 'medium':
        numFiles = Math.min(this.config.filesPerWorktree, 50);
        break;
      case 'large':
        numFiles = this.config.filesPerWorktree;
        break;
    }
    
    for (let i = 0; i < numFiles; i++) {
      const fileName = `file-${i + 1}.ts`;
      const filePath = path.join(worktreePath, fileName);
      const content = this.generateFileContent(fileName, this.config.linesPerFile);
      fs.writeFileSync(filePath, content);
    }
    
    execSync('git add .', { cwd: worktreePath, stdio: 'pipe' });
    execSync(`git commit -m "Add ${numFiles} test files"`, { 
      cwd: worktreePath, 
      stdio: 'pipe' 
    });
  }

  private generateFileContent(fileName: string, numLines: number): string {
    const lines: string[] = [
      `// Generated test file: ${fileName}`,
      `// Lines: ${numLines}`,
      '',
      'export interface TestData {',
      '  id: string;',
      '  value: number;',
      '  metadata: Record<string, unknown>;',
      '}',
      '',
      'export class TestClass {',
      '  private data: TestData[] = [];',
      '',
    ];
    
    for (let i = 0; i < numLines - lines.length - 5; i++) {
      lines.push(`  // Line ${i + 1}: ${this.generateRandomComment()}`);
    }
    
    lines.push('');
    lines.push('  public getData(): TestData[] {');
    lines.push('    return this.data;');
    lines.push('  }');
    lines.push('}');
    
    return lines.join('\n');
  }

  private generateRandomComment(): string {
    const comments = [
      'This is a test comment for performance benchmarking',
      'Performance testing requires realistic file sizes',
      'Generated content to simulate real codebase',
      'Testing sync performance with varying file sizes',
      'Benchmark data for Zenflow optimization',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }

  async cleanup(): Promise<void> {
    const repoPath = path.join(this.config.basePath, this.config.name);
    
    try {
      const worktreeListOutput = execSync('git worktree list --porcelain', {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      const worktreePaths = worktreeListOutput
        .split('\n')
        .filter(line => line.startsWith('worktree '))
        .map(line => line.replace('worktree ', ''))
        .filter(p => p !== repoPath);
      
      for (const wtPath of worktreePaths) {
        try {
          execSync(`git worktree remove ${wtPath} --force`, { 
            cwd: repoPath, 
            stdio: 'pipe' 
          });
        } catch (err) {
          // Ignore errors
        }
      }
    } catch (err) {
      // Ignore errors
    }
    
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
    
    for (let i = 0; i < this.config.numWorktrees; i++) {
      const worktreePath = path.join(this.config.basePath, `worktree-${i + 1}`);
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      }
    }
  }
}
