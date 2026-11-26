import assert from 'node:assert/strict';
import { createServer } from './solution.mjs';

async function exec(server, query, variables, contextValue = { user: null }) {
  const response = await server.executeOperation({ query, variables }, { contextValue });
  assert.equal(response.body.kind, 'single');
  return response.body.singleResult;
}

async function main() {
  // Fresh server #1: basic queries
  {
    const server = await createServer();

    const all = await exec(server, `query { books { id title author { name } } }`, {});
    assert.deepEqual(
      all.data.books.map((b) => b.id),
      ['1', '2', '3']
    );
    assert.equal(all.data.books[0].author.name, 'Ursula K. Le Guin');

    const byAuthor = await exec(
      server,
      `query($authorId: ID) { books(authorId: $authorId) { id } }`,
      { authorId: '1' }
    );
    assert.deepEqual(
      byAuthor.data.books.map((b) => b.id),
      ['1', '2']
    );

    const single = await exec(server, `query($id: ID!) { book(id: $id) { title year } }`, {
      id: '2',
    });
    assert.equal(single.data.book.title, 'The Dispossessed');
    assert.equal(single.data.book.year, 1974);

    const missing = await exec(server, `query($id: ID!) { book(id: $id) { title } }`, {
      id: '999',
    });
    assert.equal(missing.data.book, null);
    assert.ok(!missing.errors);

    console.log('PASS: basic queries');
  }

  // Unauthenticated addBook
  {
    const server = await createServer();
    const mutation = `mutation($input: AddBookInput!) { addBook(input: $input) { id } }`;
    const result = await exec(
      server,
      mutation,
      { input: { title: 'New Book', authorId: '1' } },
      { user: null }
    );
    assert.ok(result.errors && result.errors.length === 1);
    assert.equal(result.errors[0].extensions.code, 'UNAUTHENTICATED');
    console.log('PASS: unauthenticated addBook rejected');
  }

  // Invalid authorId
  {
    const server = await createServer();
    const mutation = `mutation($input: AddBookInput!) { addBook(input: $input) { id } }`;
    const result = await exec(
      server,
      mutation,
      { input: { title: 'New Book', authorId: '999' } },
      { user: { id: 'u1' } }
    );
    assert.ok(result.errors && result.errors.length === 1);
    assert.equal(result.errors[0].extensions.code, 'BAD_USER_INPUT');
    console.log('PASS: invalid authorId rejected');
  }

  // Successful addBook, id increments, new id queryable, author.books includes it
  {
    const server = await createServer();
    const mutation = `mutation($input: AddBookInput!) {
      addBook(input: $input) { id title year author { id name } }
    }`;
    const result = await exec(
      server,
      mutation,
      { input: { title: 'Parable of the Sower', authorId: '2', year: 1993 } },
      { user: { id: 'u1' } }
    );
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.equal(result.data.addBook.id, '4');
    assert.equal(result.data.addBook.title, 'Parable of the Sower');
    assert.equal(result.data.addBook.year, 1993);
    assert.equal(result.data.addBook.author.name, 'Octavia E. Butler');

    const second = await exec(
      server,
      mutation,
      { input: { title: 'Another Book', authorId: '1' } },
      { user: { id: 'u1' } }
    );
    assert.equal(second.data.addBook.id, '5');
    assert.equal(second.data.addBook.year, null);

    const check = await exec(server, `query($id: ID!) { book(id: $id) { title } }`, { id: '4' });
    assert.equal(check.data.book.title, 'Parable of the Sower');

    const authorBooks = await exec(
      server,
      `query { book(id: "4") { author { books { id } } } }`,
      {}
    );
    assert.deepEqual(
      authorBooks.data.book.author.books.map((b) => b.id),
      ['3', '4']
    );

    console.log('PASS: addBook success path, id increment, relations');
  }

  // Fresh data per createServer() call
  {
    const server1 = await createServer();
    await exec(
      server1,
      `mutation($input: AddBookInput!) { addBook(input: $input) { id } }`,
      { input: { title: 'Temp', authorId: '1' } },
      { user: { id: 'u1' } }
    );
    const server2 = await createServer();
    const result = await exec(server2, `query { books { id } }`, {});
    assert.deepEqual(
      result.data.books.map((b) => b.id),
      ['1', '2', '3']
    );
    console.log('PASS: fresh in-memory data per createServer() call');
  }

  console.log('ALL TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
