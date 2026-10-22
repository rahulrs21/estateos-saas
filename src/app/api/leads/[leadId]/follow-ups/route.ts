import {crmReadResponse,crmMutationResponse} from '@/modules/leads/server/http';
import {getLeadCrmHistory,createLeadFollowUp} from '@/modules/leads/server/crm-service';
type Context={params:Promise<{leadId:string}>};
export async function GET(request:Request, context:Context){return crmReadResponse(request,getLeadCrmHistory,await context.params);}
export async function POST(request:Request, context:Context){return crmMutationResponse(request,createLeadFollowUp,await context.params,201);}
