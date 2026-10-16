import { AuthConfigurationError } from "./configuration-error";

interface AdminConfigurationInput {
  projectId?: string;
  adminProjectId?: string;
  publicProjectId?: string;
  clientEmail?: string;
  adminClientEmail?: string;
  privateKey?: string;
  adminPrivateKey?: string;
}

function matchingSetting(primary: string | undefined, alternate: string | undefined, normalize = (value: string) => value): string | undefined {
  const first = primary?.trim() || undefined;
  const second = alternate?.trim() || undefined;
  if (first && second && normalize(first) !== normalize(second)) {
    throw new AuthConfigurationError("ADMIN_CONFIGURATION_CONFLICT");
  }
  return first ?? second;
}

export function readFirebaseAdminConfiguration(values: AdminConfigurationInput) {
  const projectId = matchingSetting(values.projectId, values.adminProjectId);
  const publicProjectId = values.publicProjectId?.trim();
  const clientEmail = matchingSetting(values.clientEmail, values.adminClientEmail);
  const privateKey = matchingSetting(values.privateKey, values.adminPrivateKey, (value) => value.replace(/\\n/g, "\n"))?.replace(/\\n/g, "\n");
  if (!projectId) throw new AuthConfigurationError("ADMIN_PROJECT_MISSING");
  if (publicProjectId && publicProjectId !== projectId) {
    throw new AuthConfigurationError("ADMIN_PROJECT_MISMATCH");
  }
  if (Boolean(clientEmail) !== Boolean(privateKey)) {
    throw new AuthConfigurationError("ADMIN_CREDENTIALS_INCOMPLETE");
  }
  const credentials = clientEmail && privateKey
    ? { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }
    : undefined;
  return { projectId, credentials };
}

/** Explicit origin configuration avoids trusting Host or forwarded headers. */
export function resolveAppOrigin(configured: string | undefined, isProduction: boolean): string {
  if (!configured) throw new AuthConfigurationError("APP_ORIGIN_MISSING");
  let url: URL;
  try { url = new URL(configured); } catch {
    throw new AuthConfigurationError("APP_ORIGIN_INVALID");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (isProduction && url.protocol !== "https:")) {
    throw new AuthConfigurationError("APP_ORIGIN_INVALID");
  }
  return url.origin;
}
