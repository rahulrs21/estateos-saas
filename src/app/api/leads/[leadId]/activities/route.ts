import {crmReadResponse,crmMutationResponse} from '@/modules/leads/server/http';
import {getLeadCrmHistory} from '@/modules/leads/server/crm-service';
import {addLeadNote} from '@/modules/leads/server/service';
import {validateInput} from '@/modules/organizations/server/validation';
import {crmUuid} from '@/modules/leads/crm-validation';
import {z} from 'zod';
type Context={params:Promise<{leadId:string}>};
export async function GET(request:Request,context:Context){return crmReadResponse(request,getLeadCrmHistory,await context.params);}
export async function POST(request:Request,context:Context){return crmMutationResponse(request,async(input,organization)=>{const value=validateInput(z.strictObject({leadId:crmUuid,description:z.string().trim().min(1).max(4000)}),input);return addLeadNote({leadId:value.leadId,note:value.description},organization);},await context.params,201);}
