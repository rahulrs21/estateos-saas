import {crmReadResponse, crmMutationResponse} from '@/modules/leads/server/http';
import {searchContacts, createContact} from '@/modules/leads/server/crm-service';
export async function GET(request:Request){return crmReadResponse(request, searchContacts);}
export async function POST(request:Request){return crmMutationResponse(request, createContact, {}, 201);}
