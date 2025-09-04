import { execFile } from "node:child_process";

export async function pdfInfo(buffer: Buffer): Promise<{ size: number; pages: number; title?: string; author?: string; }> {
  return new Promise((resolve, reject) => {
    const cp = execFile("pdfinfo", ["-"], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const g = (k: string) => stdout.match(new RegExp(`^${k}:\s*(.+)$`, "m"))?.[1]?.trim();
      resolve({
        size: buffer.length,
        pages: Number(g("Pages") || "0"),
        title: g("Title"),
        author: g("Author"),
      });
    });
    cp.stdin?.end(buffer);
  });
}

