import { defineTool } from '@deepseek-ai/dsh-tools';
import { appendFileSync } from 'node:fs';

export const name = 'nuochong-readonly-fixture';
export const inject = ['tools'];
export function apply(ctx) {
  return ctx.tools.register(defineTool({
    name: 'read_fixture',
    description: 'Return the synthetic acceptance code for this architecture test.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] },
    async execute(_, exec) {
      exec.signal.throwIfAborted();
      if (process.env.NUOCHONG_TOOL_AUDIT) {
        appendFileSync(process.env.NUOCHONG_TOOL_AUDIT, JSON.stringify({ time: Date.now(), tool: 'read_fixture' }) + '\n');
      }
      return 'NUOCHONG_FIXTURE_42';
    },
  }));
}
