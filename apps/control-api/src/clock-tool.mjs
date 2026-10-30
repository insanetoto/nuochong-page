import { defineTool } from '@deepseek-ai/dsh-tools';
export const name='nuochong-readonly-clock';
export const inject=['tools'];
export function apply(ctx){return ctx.tools.register(defineTool({
  name:'current_time',description:'Read the current UTC time. This tool has no side effects.',parameters:{},
  output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},
  async execute(_,exec){exec.signal.throwIfAborted();return new Date().toISOString();},
}));}
