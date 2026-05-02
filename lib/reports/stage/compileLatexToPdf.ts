import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function compileLatexToPdf(texSource: string): Promise<Buffer> {
  // Create an isolated directory inside the workspace
  const workspaceTmp = path.join(process.cwd(), 'scratch', 'latex-jobs', `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  
  await fs.mkdir(workspaceTmp, { recursive: true });

  const texFile = path.join(workspaceTmp, 'document.tex');
  const pdfFile = path.join(workspaceTmp, 'document.pdf');

  await fs.writeFile(texFile, texSource, 'utf-8');

  try {
    // Compile twice to stabilize table sizes, references, etc.
    // pdflatex -interaction=nonstopmode -output-directory=... file
    await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${workspaceTmp}" "${texFile}"`);
    await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${workspaceTmp}" "${texFile}"`);

    const pdfBuffer = await fs.readFile(pdfFile);

    // Clean up temporary workspace directory
    await fs.rm(workspaceTmp, { recursive: true, force: true });

    return pdfBuffer;
  } catch (error) {
    console.error('Error compiling LaTeX:', error);
    // Even on error, attempt cleanup
    try {
      await fs.rm(workspaceTmp, { recursive: true, force: true });
    } catch {}
    throw new Error('La compilation du document LaTeX a échoué. Veuillez vérifier le contenu.');
  }
}
