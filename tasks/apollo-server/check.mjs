import { runCheck, expectInstalled, importSolution, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@apollo/server', 5);
  const m = await importSolution(ws);
  expect(typeof m.createServer === 'function', '`createServer` is not exported');
  let server;
  try {
    server = m.createServer();
  } catch (e) {
    fail('crash', `createServer() threw: ${firstLine(e)}`);
  }
  expect(server && typeof server.executeOperation === 'function', 'createServer() did not return an ApolloServer');

  const run = async (query, variables, user = null) => {
    let r;
    try {
      r = await server.executeOperation({ query, variables }, { contextValue: { user } });
    } catch (e) {
      fail('crash', `executeOperation threw: ${firstLine(e)}`);
    }
    expect(r?.body?.kind === 'single', `unexpected response kind ${r?.body?.kind}`);
    const { data, errors } = r.body.singleResult;
    return { data, errors: errors || [] };
  };
  const noErrors = (r, what) => expect(!r.errors.length, `${what} returned errors: ${r.errors.map((e) => e.message).join('; ').slice(0, 200)}`);

  try {
    let r = await run('{ books { id title year author { name } } }');
    noErrors(r, 'books query');
    expectEqual(r.data.books, [
      { id: '1', title: 'A Wizard of Earthsea', year: 1968, author: { name: 'Ursula K. Le Guin' } },
      { id: '2', title: 'The Dispossessed', year: 1974, author: { name: 'Ursula K. Le Guin' } },
      { id: '3', title: 'Kindred', year: 1979, author: { name: 'Octavia E. Butler' } },
    ], 'books { id title year author { name } }');

    r = await run('query ($a: ID) { books(authorId: $a) { title } }', { a: '2' });
    noErrors(r, 'books(authorId: "2")');
    expectEqual(r.data.books, [{ title: 'Kindred' }], 'books(authorId: "2")');

    r = await run('query ($id: ID!) { book(id: $id) { title author { name books { title } } } }', { id: '2' });
    noErrors(r, 'book(id: "2")');
    expectEqual(r.data.book, { title: 'The Dispossessed', author: { name: 'Ursula K. Le Guin', books: [{ title: 'A Wizard of Earthsea' }, { title: 'The Dispossessed' }] } }, 'book(id: "2") with nested author.books');

    r = await run('{ book(id: "999") { title } }');
    noErrors(r, 'book(id: "999")');
    expectEqual(r.data.book, null, 'book(id: "999")');

    const add = 'mutation ($input: AddBookInput!) { addBook(input: $input) { id title year author { name } } }';
    r = await run(add, { input: { title: 'Parable of the Sower', authorId: '2', year: 1993 } });
    expect(r.errors.length, 'addBook without a signed-in user should return an error');
    expectEqual(r.errors[0].extensions?.code, 'UNAUTHENTICATED', 'error code of addBook without a user');

    r = await run(add, { input: { title: 'Parable of the Sower', authorId: '2', year: 1993 } }, { id: 'u1' });
    noErrors(r, 'addBook with a user');
    expectEqual(r.data.addBook, { id: '4', title: 'Parable of the Sower', year: 1993, author: { name: 'Octavia E. Butler' } }, 'addBook with a user');

    r = await run(add, { input: { title: 'Nope', authorId: '42' } }, { id: 'u1' });
    expect(r.errors.length, 'addBook with unknown authorId 42 should return an error');
    expectEqual(r.errors[0].extensions?.code, 'BAD_USER_INPUT', 'error code of addBook with unknown author');

    r = await run('{ books { title } }');
    noErrors(r, 'books query after addBook');
    expectEqual(r.data.books.map((b) => b.title), ['A Wizard of Earthsea', 'The Dispossessed', 'Kindred', 'Parable of the Sower'], 'books after addBook (the failed add must not be stored)');

    const fresh = m.createServer();
    const f = await fresh.executeOperation({ query: '{ books { id } }' }, { contextValue: { user: null } });
    await fresh.stop?.();
    expectEqual(f.body?.singleResult?.data?.books?.length, 3, 'number of books on a new createServer() (data must start fresh)');
  } finally {
    await server.stop?.();
  }
  return `@apollo/server@${version}: schema, nested resolvers, context and error codes correct`;
});
