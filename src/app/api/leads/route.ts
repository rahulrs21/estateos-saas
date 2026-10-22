import {crmReadResponse,leadMutationResponse} from '@/modules/leads/server/http';
import {createLead,listLeads} from '@/modules/leads/server/service';
import {parseLeadApiQuery} from '@/modules/leads/server/api-query';
export async function GET(request:Request){return crmReadResponse(request, input=>listLeads(parseLeadApiQuery(input)));}
export async function POST(request:Request){return leadMutationResponse(request,createLead,undefined,201);}
