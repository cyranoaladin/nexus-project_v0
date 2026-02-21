const { TestEnvironment: JSDomEnvironment } = require('jest-environment-jsdom');

// Custom Jest environment: jsdom + Node.js native Web Fetch API globals
// jsdom v20+ lacks Request/Response/fetch; Next.js route handlers need them
class JSDomWithFetchEnvironment extends JSDomEnvironment {
  constructor(config, context) {
    super(config, context);

    // Inject Node.js native Web API globals that jsdom lacks
    if (typeof this.global.Request === 'undefined') {
      this.global.Request = Request;
    }
    if (typeof this.global.Response === 'undefined') {
      this.global.Response = Response;
    }
    if (typeof this.global.Headers === 'undefined') {
      this.global.Headers = Headers;
    }
    if (typeof this.global.fetch === 'undefined') {
      this.global.fetch = fetch;
    }
    if (typeof this.global.ReadableStream === 'undefined' && typeof ReadableStream !== 'undefined') {
      this.global.ReadableStream = ReadableStream;
    }
    if (typeof this.global.WritableStream === 'undefined' && typeof WritableStream !== 'undefined') {
      this.global.WritableStream = WritableStream;
    }
    if (typeof this.global.TransformStream === 'undefined' && typeof TransformStream !== 'undefined') {
      this.global.TransformStream = TransformStream;
    }
  }
}

module.exports = JSDomWithFetchEnvironment;
