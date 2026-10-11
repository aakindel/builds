/**
 * Port map for the agent isolation contract.
 *
 * Roles get disjoint ranges so no two can contend, and so a port freed by one
 * role cannot be claimed by another.
 */

export const NEXT_DEV_PORTS = { start: 3000, end: 3010 } as const;
export const NEXT_AGENT_PORTS = { start: 3100, end: 3110 } as const;
export const NEXT_E2E_PORTS = { start: 3120, end: 3130 } as const;

export type PortRange = { start: number; end: number };

export const PORT_RANGES = {
  nextDev: NEXT_DEV_PORTS,
  nextAgent: NEXT_AGENT_PORTS,
  nextE2e: NEXT_E2E_PORTS,
} satisfies Record<string, PortRange>;

export function isInRange(port: number, range: PortRange): boolean {
  return port >= range.start && port <= range.end;
}

export function assertDisjoint(
  ranges: PortRange[] = Object.values(PORT_RANGES)
) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start <= sorted[i - 1].end) {
      throw new Error(
        `Port ranges overlap: ${sorted[i - 1].start}-${sorted[i - 1].end} and ${sorted[i].start}-${sorted[i].end}`
      );
    }
  }
}
