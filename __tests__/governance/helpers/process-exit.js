class ProcessExitError extends Error {
  constructor(code) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function installExitTrap() {
  return jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ProcessExitError(code);
  });
}

module.exports = { ProcessExitError, installExitTrap };
