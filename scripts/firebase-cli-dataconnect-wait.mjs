/**
 * Preloaded into the Firebase CLI (`node --import`) by dev:local and the
 * emulator test launchers; see firebaseCliCommand() in local-db-lib.mjs.
 *
 * Firebase CLI 15.x connects the SQL Connect emulator to its database with
 * three requests two seconds apart, but the emulator binary listens only
 * after it has compiled the schema and connectors and generated the Admin
 * SDK. With the current schema that takes about five seconds, so starts fail
 * with "Failed to make request to …/emulator/configure".
 *
 * This keeps retrying that request only while the emulator is not yet
 * listening, for at most 90 seconds. Any other error (for example a failed
 * schema migration) is passed through unchanged. Local development only.
 */
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";

const entry = process.argv[1] ?? "";
if (basename(entry) === "firebase.js") {
  // The CLI is CommonJS; requiring the same file shares the module instance the CLI uses.
  const cliRequire = createRequire(entry);
  const { DataConnectEmulatorClient } = cliRequire(join(dirname(entry), "..", "emulator", "dataconnectEmulator.js"));
  const configure = DataConnectEmulatorClient?.prototype?.configureEmulator;
  if (typeof configure === "function") {
    DataConnectEmulatorClient.prototype.configureEmulator = async function configureWhenListening(body) {
      const deadline = Date.now() + 90_000;
      for (;;) {
        try {
          return await configure.call(this, body);
        } catch (error) {
          const notListening = /Failed to make request to \S+\/emulator\/configure/.test(String(error?.message ?? error));
          if (!notListening || Date.now() > deadline) throw error;
          await new Promise(resolveWait => setTimeout(resolveWait, 500));
        }
      }
    };
  }
}
