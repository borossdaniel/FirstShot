import { parseUser } from './solution.mjs';

console.log('valid with tags:', parseUser({ email: 'a@b.com', age: 20, tags: ['x', 'y'] }));
console.log('valid without tags:', parseUser({ email: 'a@b.com', age: 13 }));
console.log('invalid email:', parseUser({ email: 'not-an-email', age: 20 }));
console.log('invalid age (too young):', parseUser({ email: 'a@b.com', age: 10 }));
console.log('invalid age (not integer):', parseUser({ email: 'a@b.com', age: 20.5 }));
console.log('multiple errors:', parseUser({ email: 'bad', age: 5, tags: [1, 2] }));
console.log('missing fields:', parseUser({}));
