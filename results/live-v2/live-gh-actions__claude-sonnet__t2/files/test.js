assert(1 + 1 === 2, "sanity check failed");

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

console.log("All tests passed.");
