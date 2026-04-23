// Polyfill for Puter.js in Node.js
if (!globalThis.Image) {
  globalThis.Image = class { constructor() { this.src = ''; } };
}

const puter = require('@heyputer/puter.js').puter;

// Puter.js expects a browser-like fetch in some internal modules
// Node 18+ has it, but it might need to be explicitly set
globalThis.fetch = globalThis.fetch || require('node-fetch');

async function test() {
  console.log("Starting Puter test...");
  try {
    const image = await puter.ai.txt2img("A simple house sketch", {
      testMode: true
    });
    console.log("Image result:", image.src ? "Source Found" : "Source Missing");
    console.log("Full result:", image.toString());
  } catch (e) {
    console.error("Puter Error:", e);
  }
}

test();
