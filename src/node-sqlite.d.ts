declare module "node:sqlite" {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    transaction<TArgs extends unknown[]>(
      fn: (...args: TArgs) => void,
    ): (...args: TArgs) => void;
  }
}
