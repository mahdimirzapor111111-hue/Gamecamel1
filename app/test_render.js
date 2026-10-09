const fs = require('fs');

// Read index-WA3TFXYh.js
const code = fs.readFileSync('app/src/main/assets/assets/index-WA3TFXYh.js', 'utf8');

// We want to see if any runtime error happens when Yr is executed!
// Let's create a minimal test runner
const vm = require('vm');

const sandbox = {
  window: {},
  document: {
    documentElement: { classList: { add() {} } },
    body: { style: {}, appendChild() {} },
    getElementById(id) {
      return { appendChild() {} };
    },
    createElement() {
      return {
        style: {},
        classList: { add() {} },
        appendChild() {},
        addEventListener() {},
        setAttribute() {},
      };
    },
    querySelectorAll() { return []; }
  },
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = v; },
    removeItem(k) { delete this.store[k]; }
  },
  navigator: {},
  location: { href: 'http://localhost/' },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
};

sandbox.window = sandbox;
sandbox.global = sandbox;

console.log('Evaluating index-WA3TFXYh.js in sandbox...');
try {
  vm.runInNewContext(code, sandbox);
  console.log('index-WA3TFXYh.js evaluated successfully without crash!');
} catch (err) {
  console.error('CRASH in index-WA3TFXYh.js:', err);
}
