/** Types for connector-routing.mjs (one database handle for several SQL Connect connectors). */
export declare function operationNames(sdkModule: Record<string, unknown>): Set<string>;
export declare function routedDataConnect<T extends {executeQuery: (...args: never[]) => unknown; executeMutation: (...args: never[]) => unknown}>(
  primary: T, routes: Array<{names: Set<string>; dc: T}>): T;
