import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';

export const typeDefs = `#graphql
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

function seed() {
  return {
    authors: [
      { id: '1', name: 'Ursula K. Le Guin' },
      { id: '2', name: 'Octavia E. Butler' },
    ],
    books: [
      { id: '1', title: 'A Wizard of Earthsea', year: 1968, authorId: '1' },
      { id: '2', title: 'The Dispossessed', year: 1974, authorId: '1' },
      { id: '3', title: 'Kindred', year: 1979, authorId: '2' },
    ],
  };
}

export function createResolvers(db = seed()) {
  return {
    Query: {
      books: (_, { authorId }) => (authorId ? db.books.filter((b) => b.authorId === authorId) : db.books),
      book: (_, { id }) => db.books.find((b) => b.id === id) ?? null,
    },
    Mutation: {
      addBook: (_, { input }, { user }) => {
        if (!user) {
          throw new GraphQLError('You must be signed in to add a book', { extensions: { code: 'UNAUTHENTICATED' } });
        }
        if (!db.authors.some((a) => a.id === input.authorId)) {
          throw new GraphQLError(`Unknown author ${input.authorId}`, {
            extensions: { code: 'BAD_USER_INPUT', argumentName: 'input' },
          });
        }
        const book = { id: String(db.books.length + 1), title: input.title, year: input.year ?? null, authorId: input.authorId };
        db.books.push(book);
        return book;
      },
    },
    Book: {
      author: (book) => db.authors.find((a) => a.id === book.authorId),
    },
    Author: {
      books: (author) => db.books.filter((b) => b.authorId === author.id),
    },
  };
}

export const resolvers = createResolvers();

export function createServer() {
  return new ApolloServer({ typeDefs, resolvers: createResolvers() });
}
