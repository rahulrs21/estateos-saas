import {crmReadResponse} from '@/modules/leads/server/http';
import {findDuplicateContacts} from '@/modules/leads/server/crm-service';
export async function GET(request:Request){return crmReadResponse(request, findDuplicateContacts);}
