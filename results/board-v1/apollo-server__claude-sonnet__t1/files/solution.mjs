import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';

const typeDefs = `#graphql
  type Author {
    id: ID!
    name: String!
    books: [Book!]!
  }

  type Book {
    id: ID!
    title: String!
    year: Int
    author: Author!
  }

  input AddBookInput {
    title: String!
    authorId: ID!
    year: Int
  }

  type Query {
    books(authorId: ID): [Book!]!
    book(id: ID!): Book
  }

  type Mutation {
    addBook(input: AddBookInput!): Book!
  }
`;

function createInitialData() {
  const authors = new Map([
    ['1', { id: '1', name: 'Ursula K. Le Guin' }],
    ['2', { id: '2', name: 'Octavia E. Butler' }],
  ]);

  const books = new Map([
    ['1', { id: '1', title: 'A Wizard of Earthsea', year: 1968, authorId: '1' }],
    ['2', { id: '2', title: 'The Dispossessed', year: 1974, authorId: '1' }],
    ['3', { id: '3', title: 'Kindred', year: 1979, authorId: '2' }],
  ]);

  return { authors, books, nextBookId: 4 };
}

function sortedBooks(books) {
  return [...books.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

export function createServer() {
  const data = createInitialData();

  const resolvers = {
    Query: {
      books: (_parent, { authorId }) => {
        const all = sortedBooks(data.books);
        return authorId == null ? all : all.filter((book) => book.authorId === authorId);
      },
      book: (_parent, { id }) => data.books.get(id) ?? null,
    },
    Mutation: {
      addBook: (_parent, { input }, context) => {
        if (!context.user) {
          throw new GraphQLError('You must be logged in to add a book', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (!data.authors.has(input.authorId)) {
          throw new GraphQLError(`No author found with id "${input.authorId}"`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        const id = String(data.nextBookId++);
        const book = { id, title: input.title, year: input.year ?? null, authorId: input.authorId };
        data.books.set(id, book);
        return book;
      },
    },
    Book: {
      author: (book) => data.authors.get(book.authorId),
    },
    Author: {
      books: (author) => sortedBooks(data.books).filter((book) => book.authorId === author.id),
    },
  };

  return new ApolloServer({ typeDefs, resolvers });
}
