import {crmMutationResponse} from '@/modules/leads/server/http';
import {archiveLead} from '@/modules/leads/server/crm-service';
export async function POST(request:Request, context:{params:Promise<{leadId:string}>}){return crmMutationResponse(request,archiveLead,await context.params);}
