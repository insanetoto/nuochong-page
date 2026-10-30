// A-06 prototype bridge using public classes/hooks only. The stock SDK server
// omits transient chunks; this deployment-owned notification is NOT upstream API.
import { HarnessSdkJsonRpcServer } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';

export const name = 'nuochong-stream-bridge';
export const inject = ['agents', 'workingDirectory'];
export function apply(ctx) {
  const transport = new JsonRpcLineTransport(process.stdin, process.stdout);
  const server = new HarnessSdkJsonRpcServer(ctx, transport, { maxTokensAsSuccess: false });
  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    transport.notify('nuochong.assistant.stream', { sessionId: agent.session.id, frame });
  });
  transport.onRequest(async (method, params) => {
    if (method === 'initialize') await ctx.get('loader')?.await();
    const result = await server.handleRequest(method, params);
    if (method === 'shutdown') setImmediate(async () => {
      try {
        await transport.flush();
        await ctx.root.fiber.dispose();
        process.exit(0);
      } catch { process.exit(1); }
    });
    return result;
  });
  ctx.effect(() => {
    transport.start();
    return async () => { await server.shutdown(); transport.close(); };
  });
}
