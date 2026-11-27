# OneShot

**Your AI coding agent writes last year's versions from memory. OneShot gives it today's, so it gets it right in one shot.**

Agents write model names, GitHub Actions versions, Docker images and runtime versions from memory, and those go stale fast. We measured it with Claude Code (Sonnet) on 6 everyday tasks (newest Claude and OpenAI model, Node and Python CI, Node and Python Dockerfiles), 10 runs per task per setup, each run checked by a real test:

| Setup | Wrote current values | Median time per run | Median cost per run |
|---|---|---|---|
| Nothing | 17 of 60 | 61 s | $0.33 |
| "Always use the newest versions" in CLAUDE.md | 54 of 60 | 68 s | $0.44 |
| **OneShot** | **60 of 60** | **47 s** | **$0.29** |

Without help, agents wrote `claude-opus-4-8` (10 of 10 runs), `actions/checkout@v4` (20 of 20), `node:24-alpine` and `python:3.13-slim`. Told to "use the newest", they searched the web: right 54 of 60 times, but the Claude model was still wrong 4 of 10 times. With OneShot they asked once and were right every time, **31% faster and 33% cheaper than telling the agent to look things up**, and no slower or more expensive than giving it no help at all. All 180 runs and transcripts are in `results/live-v2/`.

**Try it without installing anything:** paste a public GitHub repo at [oneshotagent.dev](https://oneshotagent.dev/#check), or see the Action on a [demo repo](https://github.com/borossdaniel/oneshot-demo).

## Catch retired models before they break your app

AI providers retire models on a schedule. After the date, every request to that model fails (the Claude API returns `404 not_found_error`). Agents keep writing those names into code. OneShot reads the official schedules from Anthropic and OpenAI and checks your code, `.env` files and config:

```
$ npx oneshot-agent check
3 problems to fix (these break your app or your team's rules):
  ✗ src/chat.ts:2: claude-sonnet-4-5 retires on 2026-11-30 (in 4 days). After that, requests fail. Use claude-sonnet-5-5.
  ✗ .env.example:1: gpt-5 retires on 2026-12-11 (in 15 days). After that, requests fail. Use gpt-6.1-sol (newest: gpt-6.2-sol).
  ✗ Dockerfile:1: node:20-alpine is end-of-life: no more security fixes. Use node:26-alpine.
1 outdated value:
  ! .github/workflows/ci.yml:6: actions/checkout@v4 is outdated; current is v7.
```

### On every pull request (GitHub Action)

```yaml
# .github/workflows/oneshot.yml
name: OneShot
on:
  pull_request:
  schedule:
    - cron: "0 7 * * 1"   # weekly, so a retirement date never surprises you
jobs:
  oneshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: borossdaniel/OneShot@v1
```

Problems show up as annotations on the exact lines in the pull request. It fails on things that break (retired or soon-retired models, end-of-life runtimes) and only warns about things that are merely outdated. Add `with: { strict: "true" }` to fail on those too.

## Install

**Claude Code plugin** (tools + the "check before done" hook + instructions, one install):
```
/plugin marketplace add borossdaniel/OneShot
/plugin install oneshot@oneshot
```

**Cursor:** [Add OneShot to Cursor](https://cursor.com/en/install-mcp?name=oneshot&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm9uZXNob3QtYWdlbnRAMCIsIm1jcCJdfQ==) (one click), or add to your MCP settings:
```json
{ "mcpServers": { "oneshot": { "command": "npx", "args": ["-y", "oneshot-agent@0", "mcp"] } } }
```

**Any agent with MCP:** `npx -y oneshot-agent mcp` · **CLI only:** `npx oneshot-agent facts` / `npx oneshot-agent check`

## Team rules

Put a `.oneshot.json` in your repo (or point `ONESHOT_RULES_URL` at one shared file for the whole company). Every agent gets your rules with its facts, and `check` / the GitHub Action enforce them:

```json
{
  "models":   { "allowed": ["claude-sonnet-5-5", "gpt-6.2-*"], "blocked": ["gpt-4o*"] },
  "packages": { "blocked": { "moment": "use date-fns" }, "minMajor": { "react": 19 } },
  "notes":    ["Use @acme/ui for buttons and forms"]
}
```

`npx oneshot-agent init --rules` creates an example.

## Use it in your project

```bash
npx oneshot-agent init        # MCP tools + a Claude Code Stop hook + one line in CLAUDE.md
```

Not on npm yet? Run it from GitHub: `npx github:borossdaniel/OneShot facts`

| Command | What it does |
|---|---|
| `oneshot-agent facts` | Today's newest AI model names, GitHub Actions versions, Node.js/Python LTS and matching Docker images |
| `oneshot-agent check <pkg>` | Current version of any npm or PyPI package, the install command, and known agent mistakes |
| `oneshot-agent check` | Scans the project: retired or retiring AI models, end-of-life runtimes, old GitHub Actions, outdated dependencies. Fails (exit 1) on things that break; `--strict` also fails on warnings; `--format=github` for pull request annotations |
| `oneshot-agent mcp` | MCP server with `current_facts`, `check_package` and `check_project`, for Claude Code, Cursor and others |
| `oneshot-agent hook` | Claude Code Stop hook: if anything is outdated, the agent fixes it before it can say "done" |

Claude Code only:
```bash
claude mcp add oneshot -- npx -y oneshot-agent mcp
```

No account and no tracking. Sources: npm, PyPI, deps.dev, endoflife.date, GitHub releases, and a curated model list in `data/models.json`.

### Package versions: a one-line fix is enough

For npm packages, `@latest` already knows the answer, so one line in CLAUDE.md fixes it. Across 31 libraries, agents installed an outdated major in about 1 in 5 runs; with an "install the latest" line it was 0 of 30 (`results/ab-oneline/`). OneShot still checks packages, but the live facts above are where it matters.

## The benchmark: can an agent use your library on the first try?

More and more developers never read your quickstart. They type "add Zod validation" or "set up the AI SDK" into Claude Code, Codex or Gemini CLI and accept what comes back. When the agent installs last year's major version, invents an API, or gives up, the developer doesn't file a bug. They pick a different library.

OneShot measures that moment:

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
git clone https://github.com/borossdaniel/OneShot.git && cd OneShot
npm test                     # pipeline tests, no AI needed
npm run verify-tasks         # proves each check passes good code and fails bad code
node bin/oneshot.js run tasks --agent claude --model sonnet --trials 3
node bin/oneshot.js report results --out site && open site/index.html
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

## Tasks (37)

31 library tasks and 6 live-fact tasks (newest Claude and OpenAI model, GitHub Actions for Node and Python, Node and Python Dockerfiles). Some of them:

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
import { runCheck, expectInstalled, importSolution, expectEqual } from 'oneshot-agent/check';

runCheck(async (ws) => {
  expectInstalled(ws, 'my-lib', 3);          // installed, and at least v3
  const m = await importSolution(ws);        // the agent's solution.mjs
  expectEqual(await m.doThing(2), 4, 'doThing(2)');
});
```

Then run `npx oneshot-agent run ./my-lib --agent claude --trials 5` and add the badge from `site/badges/my-lib.svg`.

## How runs are kept fair

- **Same starting point:** every run gets a fresh, empty temporary folder.
- **No local helpers:** Claude Code runs with `--setting-sources project --strict-mcp-config`, so your own plugins, hooks and MCP servers don't help or hurt the agent.
- **No hanging:** the agent can use a fixed allow-list of tools (file edits, npm, node, web fetch/search). Everything else is denied rather than left waiting for approval.
- **Limits:** each run has a time limit (`timeoutSec`) and, for Claude, a spending cap (`--max-budget-usd`, default $2).
- **Auditable:** everything is published (prompt, transcript, the agent's files, the check), so anyone can rerun and dispute a score.
- **No grading by AI:** the score comes from a test that executes the code.

## Status

- **Version:** 0.4. Live facts, retirement guard, GitHub Action, Claude Code plugin, MCP server, team rules.
- **Agents:** the benchmark runs Claude Code (Sonnet). The MCP tools work in any MCP app; Codex and Gemini benchmark runs are next.
- **Tasks:** 37 (31 libraries, 6 live facts).

MIT licensed.

## FAQ

**Does it track me or send my code anywhere?**
No. OneShot only downloads public facts: package versions (npm, PyPI, deps.dev), runtime dates (endoflife.date), Action versions (GitHub) and model lists (Anthropic and OpenAI SDKs), plus our hosted copy of those at `oneshotagent.dev/facts.json`. Your code never leaves your machine. No account, no telemetry. Set `ONESHOT_FACTS_URL=off` to skip the hosted copy. The repo check on the website downloads a public repo to a temporary folder, checks it and deletes it.

**Does it only work with Claude?**
No. The MCP tools work in Cursor, Windsurf, Codex, Claude Desktop and any other MCP app. The check before "done" (Stop hook) is Claude Code only. The CLI and the GitHub Action work with any agent, or none. The benchmark numbers are from Claude Code with Sonnet.

**Why not just tell my agent to use the newest versions?**
It helps, but the agent then has to look everything up itself: in our runs it was right 54 of 60 times. OneShot answers in one call: 60 of 60 right, 31% faster and 33% cheaper per run.

**Will it change my code?**
No. It tells your agent what is current; the agent writes the code. The Action only annotates pull requests. It fails when something will break (a retired model, an end-of-life runtime); `strict: true` also fails on older versions.

**How fresh are the facts?**
Refreshed every 6 hours from the official sources. Retirement dates come from the providers' deprecation pages. Wrong or missing? Open an issue.

## Limits

- It checks versions and known traps. It does not review your logic or find bugs.
- It needs internet to ask npm and PyPI for the latest version. Offline, it stays quiet and never blocks your agent.
- Hand-written notes exist for the libraries on the board. Other packages get the current version plus release-date and deprecation warnings.
- 0.x packages and calendar-versioned packages (certifi 2026.x) are not flagged as outdated.
- If you pin an old major on purpose, the check only warns.
- The package board uses one agent (Claude Code with Sonnet), 5 runs per library; the live-facts test 10 runs per task. Small samples, published in full.
