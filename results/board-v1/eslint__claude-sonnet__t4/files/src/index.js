function add(a, b) {
  return a + b;
}

function main() {
  const result = add(2, 3);
  if (result === 5) {
    process.exitCode = 0;
  }
  return result;
}

main();

export { add };
