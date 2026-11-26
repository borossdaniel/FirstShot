import { runCheck, importSolution, expectEqual } from '../../../src/check-helpers.js';
runCheck(async (ws) => {
  const m = await importSolution(ws);
  expectEqual(m.add(2, 3), 5, 'add(2, 3)');
});
