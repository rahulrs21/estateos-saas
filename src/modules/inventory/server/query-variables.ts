/** Remove unset optional variables before invoking generated SQL Connect queries. */
export function omitNullishQueryVariables<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null)) as T;
}
