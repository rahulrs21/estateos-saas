import {crmMutationResponse} from '@/modules/leads/server/http';
import {completeFollowUp} from '@/modules/leads/server/crm-service';
export async function POST(request:Request,context:{params:Promise<{leadId:string;followUpId:string}>}){return crmMutationResponse(request,completeFollowUp,await context.params);}
