import assert from 'node:assert/strict';
import { createServer } from './solution.mjs';

async function run() {
  // Fresh data per server instance
  {
    const server = createServer();
    await server.start();

    const allBooks = await server.executeOperation(
      { query: 'query { books { id title year author { id name } } }' },
      { contextValue: { user: null } }
    );
    assert.deepEqual(
      allBooks.body.singleResult.data.books.map((b) => b.id),
      ['1', '2', '3']
    );
    assert.equal(allBooks.body.singleResult.data.books[0].title, 'A Wizard of Earthsea');
    assert.equal(allBooks.body.singleResult.data.books[0].author.name, 'Ursula K. Le Guin');
    console.log('PASS: books() returns all books in id order with author');

    const byAuthor = await server.executeOperation(
      { query: 'query($authorId: ID) { books(authorId: $authorId) { id title } }', variables: { authorId: '1' } },
      { contextValue: { user: null } }
    );
    assert.deepEqual(
      byAuthor.body.singleResult.data.books.map((b) => b.id),
      ['1', '2']
    );
    console.log('PASS: books(authorId) filters correctly');

    const oneBook = await server.executeOperation(
      { query: 'query($id: ID!) { book(id: $id) { title year } }', variables: { id: '3' } },
      { contextValue: { user: null } }
    );
    assert.equal(oneBook.body.singleResult.data.book.title, 'Kindred');
    assert.equal(oneBook.body.singleResult.data.book.year, 1979);
    console.log('PASS: book(id) returns correct book');

    const missingBook = await server.executeOperation(
      { query: 'query($id: ID!) { book(id: $id) { title } }', variables: { id: '999' } },
      { contextValue: { user: null } }
    );
    assert.equal(missingBook.body.singleResult.data.book, null);
    console.log('PASS: book(id) returns null for unknown id');

    // Author.books resolver
    const authorBooks = await server.executeOperation(
      { query: '{ books(authorId: "2") { author { books { id } } } }' },
      { contextValue: { user: null } }
    );
    assert.deepEqual(
      authorBooks.body.singleResult.data.books[0].author.books.map((b) => b.id),
      ['3']
    );
    console.log('PASS: Author.books resolver works');

    // Unauthenticated addBook
    const unauth = await server.executeOperation(
      {
        query: 'mutation($input: AddBookInput!) { addBook(input: $input) { id } }',
        variables: { input: { title: 'New Book', authorId: '1' } },
      },
      { contextValue: { user: null } }
    );
    assert.equal(unauth.body.singleResult.errors[0].extensions.code, 'UNAUTHENTICATED');
    console.log('PASS: addBook fails with UNAUTHENTICATED when no user');

    // Bad author id
    const badAuthor = await server.executeOperation(
      {
        query: 'mutation($input: AddBookInput!) { addBook(input: $input) { id } }',
        variables: { input: { title: 'New Book', authorId: '999' } },
      },
      { contextValue: { user: { id: 'u1' } } }
    );
    assert.equal(badAuthor.body.singleResult.errors[0].extensions.code, 'BAD_USER_INPUT');
    console.log('PASS: addBook fails with BAD_USER_INPUT for unknown author');

    // Successful addBook
    const added = await server.executeOperation(
      {
        query: 'mutation($input: AddBookInput!) { addBook(input: $input) { id title year author { id } } }',
        variables: { input: { title: 'Parable of the Sower', authorId: '2', year: 1993 } },
      },
      { contextValue: { user: { id: 'u1' } } }
    );
    const newBook = added.body.singleResult.data.addBook;
    assert.equal(newBook.id, '4');
    assert.equal(newBook.title, 'Parable of the Sower');
    assert.equal(newBook.year, 1993);
    assert.equal(newBook.author.id, '2');
    console.log('PASS: addBook creates book with next id "4"');

    // Second addBook gets id "5"
    const added2 = await server.executeOperation(
      {
        query: 'mutation($input: AddBookInput!) { addBook(input: $input) { id } }',
        variables: { input: { title: 'Another Book', authorId: '1' } },
      },
      { contextValue: { user: { id: 'u1' } } }
    );
    assert.equal(added2.body.singleResult.data.addBook.id, '5');
    console.log('PASS: subsequent addBook gets id "5"');

    // addBook without year -> null
    const noYear = await server.executeOperation(
      {
        query: 'mutation($input: AddBookInput!) { addBook(input: $input) { year } }',
        variables: { input: { title: 'No Year Book', authorId: '1' } },
      },
      { contextValue: { user: { id: 'u1' } } }
    );
    assert.equal(noYear.body.singleResult.data.addBook.year, null);
    console.log('PASS: addBook without year returns null year');

    await server.stop();
  }

  // Fresh server instance starts from fresh data again
  {
    const server2 = createServer();
    await server2.start();
    const result = await server2.executeOperation(
      { query: '{ books { id } }' },
      { contextValue: { user: null } }
    );
    assert.deepEqual(result.body.singleResult.data.books.map((b) => b.id), ['1', '2', '3']);
    console.log('PASS: new createServer() call starts with fresh in-memory data');
    await server2.stop();
  }

  console.log('\nAll checks passed.');
}

run().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
