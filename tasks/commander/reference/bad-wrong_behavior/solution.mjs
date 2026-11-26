import { Command } from 'commander';
export function buildProgram() {
  const program = new Command('hello').version('1.2.3');
  program.command('greet').argument('<name>').option('--shout').option('--times <n>', 'times', '1')
    .action((name, opts) => {
      const n = parseInt(opts.times, 10) || 1;
      let msg = `Hello, ${name}!`;
      if (opts.shout) msg = msg.toUpperCase();
      for (let i = 0; i < n; i++) console.log(msg);
    });
  return program;
}
