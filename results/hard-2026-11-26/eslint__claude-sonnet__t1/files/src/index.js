export function add(a, b) {
  return a + b;
}

export function isPositive(n) {
  return n > 0 && n !== 0;
}

if (process.env.NODE_ENV !== "test") {
  add(2, 3);
}
