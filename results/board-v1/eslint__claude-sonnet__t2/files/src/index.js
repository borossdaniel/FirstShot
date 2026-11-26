function greet(name) {
  if (name === undefined) {
    name = "world";
  }
  return `Hello, ${name}!`;
}

const target = process.argv[2];
console.log(greet(target));
