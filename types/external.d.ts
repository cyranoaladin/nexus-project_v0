// Declarations for optional external modules used conditionally
// This allows Next.js build to succeed even if the modules are not installed in prod

declare module 'chartjs-node-canvas' {
  export class ChartJSNodeCanvas {
    constructor(options: any);
    renderToBuffer(configuration: any): Promise<Buffer>;
  }
}
