import {crmReadResponse,crmMutationResponse} from '@/modules/leads/server/http';
import {getLeadConfiguration,initializeLeadConfiguration} from '@/modules/leads/server/crm-service';
import {validateInput} from '@/modules/organizations/server/validation';
import {z} from 'zod';
export async function GET(request:Request){return crmReadResponse(request,async input=>{validateInput(z.strictObject({}),input);return getLeadConfiguration();});}
export async function POST(request:Request){return crmMutationResponse(request,initializeLeadConfiguration);}
