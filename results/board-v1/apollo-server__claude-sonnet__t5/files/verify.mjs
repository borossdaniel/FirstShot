import { createServer } from './solution.mjs';
import assert from 'node:assert/strict';

async function run() {
  // Test 1: books() returns all books in id order
  {
    const server = createServer();
    const res = await server.executeOperation({
      query: '{ books { id title year author { name } } }',
    }, { contextValue: { user: null } });
    const body = res.body.singleResult;
    assert.equal(body.errors, undefined);
    assert.deepEqual(body.data.books.map((b) => b.id), ['1', '2', '3']);
    assert.equal(body.data.books[0].author.name, 'Ursula K. Le Guin');
    console.log('PASS: books() all');
  }

  // Test 2: books(authorId) filters
  {
    const server = createServer();
    const res = await server.executeOperation({
      query: '{ books(authorId: "2") { id title } }',
    }, { contextValue: { user: null } });
    const body = res.body.singleResult;
    assert.equal(body.errors, undefined);
    assert.deepEqual(body.data.books.map((b) => b.id), ['3']);
    console.log('PASS: books(authorId) filter');
  }

  // Test 3: book(id) found and not found
  {
    const server = createServer();
    const res1 = await server.executeOperation({
      query: '{ book(id: "2") { title } }',
    }, { contextValue: { user: null } });
    assert.equal(res1.body.singleResult.data.book.title, 'The Dispossessed');

    const res2 = await server.executeOperation({
      query: '{ book(id: "999") { title } }',
    }, { contextValue: { user: null } });
    assert.equal(res2.body.singleResult.data.book, null);
    console.log('PASS: book(id) found/null');
  }

  // Test 4: addBook unauthenticated -> UNAUTHENTICATED
  {
    const server = createServer();
    const res = await server.executeOperation({
      query: 'mutation { addBook(input: { title: "New", authorId: "1" }) { id } }',
    }, { contextValue: { user: null } });
    const body = res.body.singleResult;
    assert.equal(body.errors[0].extensions.code, 'UNAUTHENTICATED');
    console.log('PASS: addBook unauthenticated');
  }

  // Test 5: addBook with bad authorId -> BAD_USER_INPUT
  {
    const server = createServer();
    const res = await server.executeOperation({
      query: 'mutation { addBook(input: { title: "New", authorId: "999" }) { id } }',
    }, { contextValue: { user: { id: 'u1' } } });
    const body = res.body.singleResult;
    assert.equal(body.errors[0].extensions.code, 'BAD_USER_INPUT');
    console.log('PASS: addBook bad authorId');
  }

  // Test 6: addBook success, next id, and fresh data per createServer() call
  {
    const server = createServer();
    const res = await server.executeOperation({
      query: 'mutation { addBook(input: { title: "Parable of the Sower", authorId: "2", year: 1993 }) { id title year author { name } } }',
    }, { contextValue: { user: { id: 'u1' } } });
    const body = res.body.singleResult;
    assert.equal(body.errors, undefined);
    assert.equal(body.data.addBook.id, '4');
    assert.equal(body.data.addBook.author.name, 'Octavia E. Butler');

    // confirm it's now in books()
    const res2 = await server.executeOperation({
      query: '{ books { id } }',
    }, { contextValue: { user: null } });
    assert.deepEqual(res2.body.singleResult.data.books.map((b) => b.id), ['1', '2', '3', '4']);

    // a brand new server instance should NOT have book 4
    const server2 = createServer();
    const res3 = await server2.executeOperation({
      query: '{ book(id: "4") { id } }',
    }, { contextValue: { user: null } });
    assert.equal(res3.body.singleResult.data.book, null);
    console.log('PASS: addBook success + fresh data isolation');
  }

  // Test 7: addBook with omitted year -> null
  {
    const server = createServer();
    const res = await server.executeOperation({
      query: 'mutation { addBook(input: { title: "No Year", authorId: "1" }) { year } }',
    }, { contextValue: { user: { id: 'u1' } } });
    assert.equal(res.body.singleResult.data.addBook.year, null);
    console.log('PASS: addBook omitted year -> null');
  }

  console.log('\nAll checks passed.');
}

run().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
