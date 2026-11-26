function greet(name) {
  if (name === undefined) {
    return 'Hello, World!';
  }
  return `Hello, ${name}!`;
}

const target = process.argv[2];
console.log(greet(target));

export { greet };
