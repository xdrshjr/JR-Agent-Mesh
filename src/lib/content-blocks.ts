import type { ContentBlock, ToolCallRecord } from '@/lib/types';

export type ContentGroup =
  | { type: 'text'; text: string }
  | { type: 'tools'; toolCalls: ToolCallRecord[] }
  | { type: 'thinking'; text: string };

export function groupContentBlocks(
  blocks: ContentBlock[],
  toolCalls: ToolCallRecord[],
): ContentGroup[] {
  const groups: ContentGroup[] = [];

  for (const block of blocks) {
    if (block.type === 'text') {
      const last = groups[groups.length - 1];
      if (last && last.type === 'text') {
        last.text += block.text;
      } else {
        groups.push({ type: 'text', text: block.text });
      }
    } else if (block.type === 'thinking') {
      const last = groups[groups.length - 1];
      if (last && last.type === 'thinking') {
        last.text += block.text;
      } else {
        groups.push({ type: 'thinking', text: block.text });
      }
    } else {
      const tc = toolCalls.find((t) => t.id === block.toolCallId);
      if (!tc) continue;
      const last = groups[groups.length - 1];
      if (last && last.type === 'tools') {
        last.toolCalls.push(tc);
      } else {
        groups.push({ type: 'tools', toolCalls: [tc] });
      }
    }
  }

  return groups;
}
