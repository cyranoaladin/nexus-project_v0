// Polyfill IntersectionObserver pour Jest/jsdom
if (typeof global !== 'undefined' && !global.IntersectionObserver) {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
