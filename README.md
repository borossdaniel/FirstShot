# FirstShot

**Coding agents install last year's libraries. FirstShot stops that, and measures it.**

In our board runs, about 1 in 5 Claude Code runs wrote an outdated major version into `package.json` from memory (`commander@^12` when 15 is current, `vitest@^2` when 5 is current), tested against it, and reported "verified".

## Use it in your project

```bash
npx firstshot init        # adds the MCP tools, a Claude Code Stop hook and one line in CLAUDE.md
```

Not on npm yet? Run it straight from GitHub: `npx github:borossdaniel/FirstShot check zod`

| Piece | What it does |
|---|---|
| `firstshot check <pkg>` | Current version from npm, the exact install command, and the mistakes agents make with that library |
| `firstshot check` | Flags dependencies in `package.json` that are on an outdated major. Exits 1, so it also works in CI |
| `firstshot mcp` | MCP server with `check_package` and `check_project` tools, for Claude Code, Cursor and others |
| `firstshot hook` | Claude Code Stop hook. While a dependency is outdated, it sends the agent back to fix it before it can say "done" |

Claude Code only:
```bash
claude mcp add firstshot -- npx -y firstshot mcp
```

No account and no tracking. `check` only asks the public npm registry for the latest version.

## The benchmark: can an agent use your library on the first try?

More and more developers never read your quickstart. They type "add Zod validation" or "set up the AI SDK" into Claude Code, Codex or Gemini CLI and accept what comes back. When the agent installs last year's major version, invents an API, or gives up, the developer doesn't file a bug. They pick a different library.

FirstShot measures that moment:

1. It creates an **empty folder** and gives a real agent the prompt a developer would type.
2. The agent works **unattended**. Nobody answers questions and nothing hangs on a permission prompt.
3. A **hidden test** then runs the code. An AI never grades the work.
4. You get a score ("4/5 first tries"), the failure type, time and cost, the full transcript, the files the agent wrote, and a README badge.

```
▶ ai-sdk · claude/sonnet · trial 1
  ✅ pass — ai@7.0.183: multi-step tool call and structured output correct (249.6s, $1.744)
▶ ai-sdk · claude/sonnet · trial 2
  ❌ outdated_major — ai@5.0.294 installed, current major is 7 (126.3s, $0.628)
▶ zod · claude/sonnet · trial 1
  ✅ pass — zod@4.6.7: schema, defaults and error messages correct (52s, $0.429)
```

![Leaderboard after the first 23 real runs](docs/leaderboard-demo.jpg)

**First real runs, 26 Nov 2026:** Claude Code with Sonnet, 23 runs across 13 libraries. The runs are in `results/`.

- **21 of 23 worked.** That includes libraries whose current major version came out after the model's training data: OpenAI SDK 7, Anthropic SDK 1.x, Stripe 23, Commander 15, ESLint 10 and Tailwind 4.
- **Both failures were the same quiet mistake.** The agent wrote an old version into `package.json` from memory: `"ai": "^5.0.0"` when v7 is current, and `"vitest": "^2.1.9"` when v5 is current. It then tested against that old version and reported success, without mentioning the version.
- **Some libraries cost much more agent effort.** Vercel AI SDK runs had a median of 126 seconds and about $1.05 a run (one took 51 turns). Most libraries were around 40 seconds and $0.30.

These are small samples, so read them as hints, not rankings.

## Quick start

```bash
git clone https://github.com/borossdaniel/FirstShot.git && cd FirstShot
npm test                     # pipeline tests, no AI needed
npm run verify-tasks         # proves each check passes good code and fails bad code
node bin/firstshot.js run tasks --agent claude --model sonnet --trials 3
node bin/firstshot.js report results --out site && open site/index.html
```

It needs Node 20 or newer and a logged-in agent CLI (`claude`, `codex` or `gemini`). There are no npm dependencies.

## What counts as a failure

| Category | Meaning |
|---|---|
| `outdated_major` | The agent installed an old major version (for example Express 4 or Zod 3) |
| `not_installed` | The library never got installed, often because of a made-up package name |
| `crash` | The code throws when loaded or called |
| `wrong_behavior` | It runs but does the wrong thing, for example a 404 that is plain text instead of JSON |
| `no_solution` | The file we asked for was never written |
| `agent_timeout` / `agent_error` | The agent run itself died. It counts against the run, not the library |

## Tasks (13)

| Task | What it tests | Typical trap |
|---|---|---|
| `zod` | Schema, defaults, per-field error messages | v3 vs v4 APIs (`z.string().email()` vs `z.email()`, `flatten()` vs `z.flattenError`) |
| `date-fns` | Business days, strict distance, ISO week labels | `yyyy` vs `RRRR` ISO week-year |
| `hono` | Routes, middleware, JSON 404 | Default 404 is plain text |
| `express` | Wildcard route, async errors | Express 5 wildcard syntax (`/*name`) and async error handling |
| `ai-sdk` | Multi-step tool call, structured output | `maxSteps` and `parameters` from v4 vs `stopWhen` and `inputSchema` |
| `openai` | Responses API text and structured output (v7, July 2026) | Chat Completions instead of Responses; no `json_schema` format |
| `anthropic` | Full tool-use loop (SDK 1.x, Oct 2026) | Tool result sent as plain text instead of a `tool_result` block |
| `stripe` | Subscription Checkout Session (v23, Oct 2026) | Missing `{CHECKOUT_SESSION_ID}` in the success URL |
| `mcp` | MCP server: tool with Zod validation and a resource | Deprecated `server.tool()`; non-text tool results |
| `commander` | Subcommand, options, built-in validation (v15, May 2026) | Hand-rolled validation instead of `InvalidArgumentError` |
| `tailwind` | Static-site build with a custom colour | Tailwind 3 setup (`tailwind.config.js`, `@tailwind` directives) |
| `eslint` | Flat config, rules, Node globals (v10) | Legacy `.eslintrc`, missing `globals.node` |
| `vitest` | Tests that run once and catch broken code (v5) | Watch mode; tests that miss edge cases |

API tasks (OpenAI, Anthropic, Stripe) run against a local fake server, so they need no keys and spend no money. The check also verifies exactly what the code sent.

Each task ships with `reference/good` and `reference/bad-*` solutions. `npm run verify-tasks` runs them through the real check, so you can see the test is fair before trusting a score.

## Add your own library

A task is a folder:

```
my-lib/
  task.json     { "id", "name", "package", "currentMajor", "prompt", "timeoutSec" }
  check.mjs     a real test that runs after the agent finishes
  reference/    optional: good/ and bad-<category>/ solutions
```

```js
// check.mjs
import { runCheck, expectInstalled, importSolution, expectEqual } from 'firstshot/check';

runCheck(async (ws) => {
  expectInstalled(ws, 'my-lib', 3);          // installed, and at least v3
  const m = await importSolution(ws);        // the agent's solution.mjs
  expectEqual(await m.doThing(2), 4, 'doThing(2)');
});
```

Then run `npx firstshot run ./my-lib --agent claude --trials 5` and add the badge from `site/badges/my-lib.svg`.

## How runs are kept fair

- **Same starting point:** every run gets a fresh, empty temporary folder.
- **No local helpers:** Claude Code runs with `--setting-sources project --strict-mcp-config`, so your own plugins, hooks and MCP servers don't help or hurt the agent.
- **No hanging:** the agent can use a fixed allow-list of tools (file edits, npm, node, web fetch/search). Everything else is denied rather than left waiting for approval.
- **Limits:** each run has a time limit (`timeoutSec`) and, for Claude, a spending cap (`--max-budget-usd`, default $2).
- **Auditable:** everything is published (prompt, transcript, the agent's files, the check), so anyone can rerun and dispute a score.
- **No grading by AI:** the score comes from a test that executes the code.

## Status

- **Version:** 0.1, an MVP.
- **Agents:** the Claude Code adapter has been tested. The Codex and Gemini adapters are written but not yet run.
- **Tasks:** 13 (5 starter, 8 harder).
- **Next:** more tasks, Python support, a GitHub Action that re-runs on every docs change, and a hosted leaderboard.

MIT licensed.

## Limits

- It checks versions and known traps. It does not review your logic or find bugs.
- It needs internet to ask npm and PyPI for the latest version. Offline, it stays quiet and never blocks your agent.
- Hand-written notes exist for the libraries on the board. Other packages get the current version plus release-date and deprecation warnings.
- 0.x packages and calendar-versioned packages (certifi 2026.x) are not flagged as outdated.
- If you pin an old major on purpose, the check only warns.
- The board uses one agent (Claude Code with Sonnet), 5 runs per library. Small samples, published in full.
