// The Course Agent's simulator tool as a line server: one JSON line in ({id, layout}), one JSON line out ({id, report}).
// The eval (scripts/course-agent-eval.ts) runs on the machine that holds the Baseten key and reaches this over ssh, so the key never leaves it
// and the simulator work runs on the VM. Usage: npx tsx scripts/course-agent-tools-server.ts
import { createInterface } from 'node:readline';
import { testLayout } from '../src/slice/course-agent-tools';

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const { id, layout } = JSON.parse(line) as { id: number; layout: Parameters<typeof testLayout>[0] };
  process.stdout.write(JSON.stringify({ id, report: testLayout(layout) }) + '\n');
}
