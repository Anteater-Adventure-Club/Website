declare module "talisman/metrics/damerau-levenshtein" {
  export default function distance(a: string[], b: string[]): number;
}

declare module "munkres-js" {
  export default function assign(costs: number[][]): [number, number][];
}
