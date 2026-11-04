import "server-only";

import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { asMember, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";

/*
 * Inbox attachment downloads (docs/INBOX_SECURITY.md#attachments). The database
 * checks that the member may see the conversation, that the file is stored and
 * not blocked, and audits the access in the same transaction. The file is then
 * streamed by the server as a download: never a public or signed URL.
 */

export async function attachmentFile(context: Context, rawConversationId: string, rawId: string) {
  const conversationId = parseInput(idSchema, rawConversationId);
  const id = parseInput(idSchema, rawId);
  const data = await asMember(context, "OpenInboxAttachment", (dc, options) => sdk.openInboxAttachment(dc, {organizationId: context.organizationId, conversationId, id}, options));
  const file = data.file?.attachment;
  const root = `organizations/${canonicalUuid(context.organizationId)}/inbox/`;
  if (!file?.storagePath || !file.storagePath.startsWith(root) || file.storagePath.includes("..")) throw new WorkspaceError("NOT_FOUND", 404, "This attachment is not available.");
  const [bytes] = await getFirebaseAdminStorageBucket().file(file.storagePath).download();
  return {bytes, fileName: file.fileName, mimeType: file.mimeType};
}
