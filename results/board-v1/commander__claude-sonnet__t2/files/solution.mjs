import { Command, InvalidArgumentError } from 'commander';

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('must be a positive integer.');
  }
  return parsed;
}

export function buildProgram() {
  const program = new Command();

  program
    .name('hello')
    .version('1.2.3');

  program
    .command('greet <name>')
    .option('--shout', 'uppercase the greeting')
    .option('--times <n>', 'how many times to print it', parsePositiveInteger, 1)
    .action((name, options) => {
      let message = `Hello, ${name}!`;
      if (options.shout) {
        message = message.toUpperCase();
      }
      for (let i = 0; i < options.times; i++) {
        console.log(message);
      }
    });

  return program;
}
