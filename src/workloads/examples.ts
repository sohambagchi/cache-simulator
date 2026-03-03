export type WorkloadExample = {
  id: string;
  label: string;
  description: string;
  text: string;
};

export const BUILTIN_WORKLOAD_EXAMPLES: readonly WorkloadExample[] = [
  {
    id: "sequential-read-warmup",
    label: "Sequential Read Warmup",
    description: "Simple read walk to illustrate compulsory misses and then hits.",
    text: "R 0\nR 4\nR 8\nR 0\nR 4",
  },
  {
    id: "writeback-eviction-cascade",
    label: "Write-Back Eviction Cascade",
    description: "Writes that force dirty eviction and downstream write-back.",
    text: "W 0 10\nW 64 20\nW 128 30\nR 0",
  },
  {
    id: "wna-bypass-demo",
    label: "Write-No-Allocate Bypass",
    description: "Write misses that bypass local allocation under WNA.",
    text: "W 32 7\nW 96 9\nR 32",
  },
];
