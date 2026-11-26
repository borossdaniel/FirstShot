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
  const authors = [
    { id: '1', name: 'Ursula K. Le Guin' },
    { id: '2', name: 'Octavia E. Butler' },
  ];

  const books = [
    { id: '1', title: 'A Wizard of Earthsea', year: 1968, authorId: '1' },
    { id: '2', title: 'The Dispossessed', year: 1974, authorId: '1' },
    { id: '3', title: 'Kindred', year: 1979, authorId: '2' },
  ];

  return { authors, books };
}

function makeResolvers(data) {
  return {
    Query: {
      books: (_parent, { authorId }) => {
        const sorted = [...data.books].sort((a, b) => Number(a.id) - Number(b.id));
        if (authorId == null) return sorted;
        return sorted.filter((book) => book.authorId === authorId);
      },
      book: (_parent, { id }) => data.books.find((book) => book.id === id) ?? null,
    },
    Mutation: {
      addBook: (_parent, { input }, context) => {
        if (!context.user) {
          throw new GraphQLError('You must be logged in to add a book', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const author = data.authors.find((a) => a.id === input.authorId);
        if (!author) {
          throw new GraphQLError(`No author found with id "${input.authorId}"`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        const nextId = String(
          data.books.reduce((max, book) => Math.max(max, Number(book.id)), 0) + 1
        );

        const book = {
          id: nextId,
          title: input.title,
          year: input.year ?? null,
          authorId: input.authorId,
        };

        data.books.push(book);
        return book;
      },
    },
    Book: {
      author: (book) => data.authors.find((a) => a.id === book.authorId),
    },
    Author: {
      books: (author) =>
        data.books
          .filter((book) => book.authorId === author.id)
          .sort((a, b) => Number(a.id) - Number(b.id)),
    },
  };
}

export function createServer() {
  const data = createInitialData();

  return new ApolloServer({
    typeDefs,
    resolvers: makeResolvers(data),
  });
}
