/*
 * One database handle for several SQL Connect connectors (docs/STAGING_DEPLOYMENT.md#connectors).
 *
 * A hosted connector may hold at most 800 KB of operation source, so EstateOS's operations live in two connectors:
 * "example" (CRM, inventory, AI, websites, automations) and "messaging" (inbox, WhatsApp, email, calls). A generated
 * admin function runs its operation by NAME on the handle it is given (`dc.executeQuery("CreateInboxReplyDraft", …)`),
 * so a handle that sends each name to the connector that holds it lets every caller keep passing one handle. Security
 * is unchanged: each operation's @auth rules run on its own connector, with the same impersonation options.
 *
 * Plain JavaScript (no imports) so the app (TypeScript) and the integration tests and scripts (.mjs) share it.
 */

/**
 * The operation names (PascalCase) a generated admin SDK module runs: its exported functions, first letter
 * upper-cased (`createInboxReplyDraft` runs `CreateInboxReplyDraft`; checked for every operation in the tests).
 * @param {Record<string, unknown>} sdkModule
 * @returns {Set<string>}
 */
export function operationNames(sdkModule) {
  const names = new Set();
  for (const [key, value] of Object.entries(sdkModule)) {
    if (typeof value === "function" && /^[a-z][A-Za-z0-9_]*$/.test(key)) names.add(key[0].toUpperCase() + key.slice(1));
  }
  return names;
}

/**
 * A handle that runs each named operation on the connector holding it, and everything else (connectorConfig, app,
 * executeGraphql, insert…) on the primary handle. An operation found in no route runs on the primary connector,
 * which reports it as unknown, as before.
 * @template {{executeQuery: Function, executeMutation: Function, useGen?: Function}} T
 * @param {T} primary the "example" connector's handle
 * @param {Array<{names: Set<string>, dc: T}>} routes the other connectors' handles and operation names
 * @returns {T}
 */
export function routedDataConnect(primary, routes) {
  for (const route of routes) for (const name of route.names) {
    if (routes.filter(other => other.names.has(name)).length > 1) throw new Error(`Operation ${name} is in more than one routed connector.`);
  }
  const handleFor = name => routes.find(route => route.names.has(name))?.dc ?? primary;
  return new Proxy(primary, {
    get(target, property) {
      if (property === "executeQuery" || property === "executeMutation") {
        return (name, variables, options) => {
          const dc = handleFor(name);
          return dc[property](name, variables, options);
        };
      }
      if (property === "useGen") {
        return value => { for (const dc of [target, ...routes.map(route => route.dc)]) dc.useGen?.(value); };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
