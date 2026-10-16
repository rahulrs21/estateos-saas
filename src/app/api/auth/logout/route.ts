import { logoutResponse } from "@/modules/auth/server/logout";

// Cache Components uses Node.js and disallows per-route runtime exports.
export const POST = logoutResponse;
