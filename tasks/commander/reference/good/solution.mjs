import { Command, InvalidArgumentError } from 'commander';

function positiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError('Must be a positive integer.');
  return n;
}

export function buildProgram() {
  const program = new Command('hello').version('1.2.3');
  program
    .command('greet')
    .argument('<name>')
    .option('--shout', 'uppercase the greeting')
    .option('--times <n>', 'how many times', positiveInt, 1)
    .action((name, opts) => {
      let msg = `Hello, ${name}!`;
      if (opts.shout) msg = msg.toUpperCase();
      for (let i = 0; i < opts.times; i++) console.log(msg);
    });
  return program;
}
