import {crmReadResponse, crmMutationResponse} from '@/modules/leads/server/http';
import {getContact, updateContact} from '@/modules/leads/server/crm-service';
type Context={params:Promise<{contactId:string}>};
export async function GET(request:Request, context:Context){return crmReadResponse(request,getContact,await context.params);}
export async function PATCH(request:Request, context:Context){return crmMutationResponse(request,updateContact,await context.params);}
