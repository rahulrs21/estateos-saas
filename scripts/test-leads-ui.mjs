import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = join(root, ".tmp");
mkdirSync(temporaryRoot, { recursive: true });
const fixture = mkdtempSync(join(temporaryRoot, "leads-ui-"));
const browsers = process.env.ESTATEOS_TEST_BROWSER ? [process.env.ESTATEOS_TEST_BROWSER] : [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(existsSync);
if (!browsers.length) throw new Error("Install Chrome/Edge, or set ESTATEOS_TEST_BROWSER to a Chromium executable.");

function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* Already stopped. */ }
  } else child.kill("SIGTERM");
}
function write(name, content) {
  const target = join(fixture, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

// Component tests only: this isolated loopback app imports the real lead UI,
// but supplies synthetic records and controlled HTTP responses. It never loads
// .env.local, initializes Firebase, fakes a production session, or mounts the
// production API handlers. SQL emulator tests separately prove authorization,
// transactional database persistence, and organization isolation.
write("package.json", '{"name":"estateos-leads-ui-test","private":true}');
write("next.config.mjs", `export default {turbopack:{root:${JSON.stringify(root)},rules:{'*.css':{loaders:['@tailwindcss/turbopack'],as:'*.css'}}}};`);
write("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", esModuleInterop: true, skipLibCheck: true, baseUrl: "../..", paths: { "@/*": ["src/*"] }, plugins: [{ name: "next" }] }, include: ["**/*.ts", "**/*.tsx", ".next/dev/types/**/*.ts"], exclude: ["node_modules"] }));
write("app/style.css", '@import "../../../src/app/globals.css";');
write("app/layout.tsx", `import {Providers} from '@/components/providers';import './style.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>}`);
write("app/ready.tsx", `'use client';import{useEffect,useState}from'react';export function Ready(){const[ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <span hidden id="fixture-ready" data-ready={ready}/>}`);
write("lib/store.ts", `
import {randomUUID} from 'node:crypto';
const organizationId='10000000-0000-4000-8000-000000000001';
const membershipId='10000000-0000-4000-8000-000000000002';
const pipelineId='10000000-0000-4000-8000-000000000003';
const sourceId='10000000-0000-4000-8000-000000000004';
const statuses=['NEW','CONTACTED','QUALIFIED','VIEWING_SCHEDULED','VIEWING_COMPLETED','NEGOTIATION','WON','LOST'];
const names=['New','Contacted','Qualified','Viewing Scheduled','Viewing Completed','Negotiation','Won','Lost'];
const stages=statuses.map((status,index)=>({id:'10000000-0000-4000-8000-'+String(100+index).padStart(12,'0'),name:names[index],status,position:index,stageType:index===6?'WON':index===7?'LOST':'OPEN'}));
const assignee={id:membershipId,email:'agent@example.test',role:'AGENT',userProfile:{uid:'fixture-agent',displayName:'Fixture Agent'}};
const workspace={organization:{id:organizationId,name:'Synthetic UI Company'},membership:{id:membershipId,role:'OWNER'},canManageAssignments:true,branches:[],assignees:[assignee],pipelines:[{id:pipelineId,name:'Sales Pipeline',isDefault:true,isActive:true,stages}],sources:[{id:sourceId,name:'Referral',sourceType:'MANUAL'}]};
function makeLead(index:number){return {id:'20000000-0000-4000-8000-'+String(index).padStart(12,'0'),organizationId,fullName:'Fixture Prospect '+index,email:'prospect'+index+'@example.test',phone:'+971501234567',source:'Referral',sourceId,status:'NEW',pipelineId,pipelineStageId:stages[0].id,pipelineStage:stages[0],assignedMembershipId:membershipId,assignedMembership:assignee,createdAt:'2026-10-19T10:00:00.000Z',updatedAt:'2026-10-19T10:00:00.000Z',currency:'AED',priority:'NORMAL',transactionType:'BUY',budgetMin:500000,budgetMax:1000000,preferredLocation:'Dubai Marina',propertyType:'APARTMENT',bedroomPreference:'2'};}
type Store={leads:any[],activities:any[],followUps:any[],requests:any[],failNext:boolean};
const shared=globalThis as typeof globalThis & {estateosLeadUiFixture?:Store};
export const store=shared.estateosLeadUiFixture??=( {leads:Array.from({length:12},(_,index)=>makeLead(index+1)),activities:[],followUps:[],requests:[],failNext:false});
const project={id:'30000000-0000-4000-8000-000000000001',projectName:'Fixture Marina Project'};
const property={id:'30000000-0000-4000-8000-000000000002',propertyReference:'UI-UNIT-101',projectId:project.id,project,propertyType:'APARTMENT',bedrooms:2,community:'Dubai Marina',emirate:'DUBAI',area:null,inventoryStatus:'AVAILABLE',archivedAt:null,assignedMembershipId:membershipId};
export function propertyData(id:string){
 const lead=store.leads.find(row=>row.id===id);
 const shortlist=lead?.propertyInterests??[],viewings=lead?.propertyViewings??[];
 return {organizationId,page:1,candidateTotal:1,reviewed:1,primaryProject:lead?.primaryProject??null,primaryProperty:lead?.primaryProperty??null,shortlist,shortlistTotal:shortlist.length,viewings,viewingTotal:viewings.length,leadAssignedMembershipId:membershipId,viewingAssignees:[{id:membershipId,role:'AGENT',name:'Fixture Agent'}],matches:[{property,listing:{id:'30000000-0000-4000-8000-000000000003',listingPurpose:'SALE',askingPriceMinor:'100000000',currency:'AED'},reasons:['Available property','Matches Dubai Marina','Within budget']}]};
}
export function pageData(params:Record<string,string|undefined>={}){
 const filters={search:'',status:'',branchId:'',assignedMembershipId:'',sourceId:'',priority:'',createdFrom:'',createdTo:'',sort:'CREATED_DESC',view:'LIST',followUp:'ALL',page:1,pageSize:10,...params};
 filters.page=Number(filters.page);filters.pageSize=Number(filters.pageSize);
 let rows=store.leads.filter(lead=>(!filters.search||[lead.fullName,lead.email,lead.phone].some(value=>value?.toLowerCase().includes(filters.search.toLowerCase())))&&(!filters.status||lead.status===filters.status)&&(!filters.sourceId||lead.sourceId===filters.sourceId)&&(!filters.priority||lead.priority===filters.priority)&&(!filters.assignedMembershipId||lead.assignedMembershipId===filters.assignedMembershipId));
 if(filters.sort==='NAME_ASC')rows=rows.toSorted((a,b)=>a.fullName.localeCompare(b.fullName));
 const total=rows.length;const start=(filters.page-1)*filters.pageSize;
 const metrics={total:store.leads.length,new:store.leads.filter(x=>x.status==='NEW').length,qualified:store.leads.filter(x=>x.status==='QUALIFIED').length,won:store.leads.filter(x=>x.status==='WON').length};
 return {...workspace,filters,total,metrics,leads:rows.slice(start,start+filters.pageSize),hasNext:start+filters.pageSize<total};
}
export function formData(id?:string){return {...workspace,lead:id?store.leads.find(x=>x.id===id):null};}
export function detailData(id:string){return {...workspace,lead:store.leads.find(x=>x.id===id),activities:store.activities.filter(x=>x.leadId===id),activityPage:1,hasMoreActivities:false,followUps:store.followUps.filter(x=>x.leadId===id),followUpPage:1,followUpTotal:store.followUps.filter(x=>x.leadId===id).length,hasMoreFollowUps:false,assignmentHistory:[],stageHistory:[]};}
function activity(leadId:string,kind:string,note?:string){store.activities.unshift({id:randomUUID(),organizationId,leadId,actorUid:'fixture-agent',actor:{uid:'fixture-agent',displayName:'Fixture User'},kind,note,createdAt:new Date().toISOString()});}
export async function respond(request:Request,path:string[]){
 if(path.join('/')==='auth/csrf')return Response.json({csrfToken:'component-test-only'});
 if(request.method==='GET'){
  if(path[0]==='inventory'&&path[1]==='projects')return Response.json({data:{projects:[]}});
  if(path[0]==='inventory'&&path[1]==='properties')return Response.json({data:{properties:[property]}});
  if(path[0]==='leads'&&path[2]==='properties')return Response.json({data:propertyData(path[1])});
  return Response.json({error:{message:'Unknown component fixture read.'}},{status:404});
 }
 const body=await request.json();
 store.requests.push({path:path.join('/'),method:request.method,body,organization:request.headers.get('X-EstateOS-Organization'),csrf:request.headers.get('X-CSRF-Token')});
 if(store.failNext){store.failNext=false;return Response.json({error:{message:'Fixture rejected the change.'}},{status:409});}
 let lead=store.leads.find(x=>x.id===path[1]);
 if(path.length===1&&path[0]==='leads'){
  lead={...makeLead(100),...body,id:randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  lead.pipelineStage=stages.find(x=>x.id===lead.pipelineStageId)??stages[0];lead.pipelineStageId=lead.pipelineStage.id;lead.status=lead.pipelineStage.status;
  store.leads.unshift(lead);activity(lead.id,'LEAD_CREATED');if(body.initialNote)activity(lead.id,'LEAD_NOTE_ADDED',body.initialNote);
 }else if(lead&&path.length===2){Object.assign(lead,body);activity(lead.id,'LEAD_UPDATED');}
 else if(lead&&path[2]==='stage'){const stage=stages.find(x=>x.id===body.pipelineStageId);if(stage){lead.status=stage.status;lead.pipelineStageId=stage.id;lead.pipelineStage=stage;activity(lead.id,'LEAD_STATUS_CHANGED');}}
 else if(lead&&path[2]==='status'){lead.status=body.status;const stage=stages.find(x=>x.status===body.status);if(stage){lead.pipelineStageId=stage.id;lead.pipelineStage=stage;}activity(lead.id,'LEAD_STATUS_CHANGED');}
 else if(lead&&(path[2]==='notes'||path[2]==='activities'))activity(lead.id,'LEAD_NOTE_ADDED',body.note??body.description);
 else if(lead&&path[2]==='assignment'){lead.assignedMembershipId=body.assignedMembershipId;lead.assignedMembership=body.assignedMembershipId?assignee:null;activity(lead.id,'LEAD_ASSIGNED');}
 else if(lead&&path[2]==='property-interest'){lead.primaryProperty=body.propertyId?property:null;lead.primaryProject=body.projectId?project:null;}
 else if(lead&&path[2]==='properties'){
  lead.propertyInterests??=[];const current=lead.propertyInterests.find((row:any)=>row.propertyId===body.propertyId);
  if(current)Object.assign(current,body,{updatedAt:new Date().toISOString()});
  else lead.propertyInterests.push({id:randomUUID(),propertyId:property.id,property,status:body.status,notes:body.notes??null,updatedAt:new Date().toISOString()});
 }
 else if(lead&&path[2]==='viewings'){
  lead.propertyViewings??=[];
  if(path[3]){const current=lead.propertyViewings.find((row:any)=>row.id===path[3]);if(current)Object.assign(current,{status:body.status,viewingNotes:body.notes,customerConfirmation:body.customerConfirmation,outcome:body.outcome??null,followUp:body.followUp?{id:randomUUID(),title:body.followUp.title,dueAt:body.followUp.dueAt,status:'PENDING'}:current.followUp,updatedAt:new Date().toISOString()});}
  else lead.propertyViewings.push({id:randomUUID(),propertyId:property.id,property,status:'SCHEDULED',scheduledAt:body.scheduledAt,viewingNotes:body.notes,assignedMembershipId:body.assignedMembershipId,assignedMembership:assignee,customerConfirmation:body.customerConfirmation,outcome:null,followUp:null,updatedAt:new Date().toISOString()});
 }
 else if(lead&&path[2]==='follow-ups'){if(path[4]==='complete'){const followUp=store.followUps.find(x=>x.id===path[3]);if(followUp){followUp.status='COMPLETED';followUp.completedAt=new Date().toISOString();}}else{store.followUps.unshift({id:randomUUID(),leadId:lead.id,organizationId,title:body.title,dueAt:body.dueAt,status:'PENDING',assignedUserId:membershipId,assignedUser:assignee,createdAt:new Date().toISOString()});}activity(lead.id,'FOLLOW_UP_SCHEDULED');}
 if(!lead)return Response.json({error:{message:'Fixture record unavailable.'}},{status:404});
 return Response.json({data:{lead,possibleDuplicates:[],warnings:[]}});
}
`);
write("app/leads/page.tsx", `import {LeadsList} from '@/modules/leads/components/leads-list';import{pageData}from'../../lib/store';import{Ready}from'../ready';export const dynamic='force-dynamic';export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){return <main className="p-4 sm:p-8"><Ready/><LeadsList data={pageData(await searchParams) as any}/></main>}`);
write("app/leads/new/page.tsx", `import{LeadForm}from'@/modules/leads/components/lead-form';import{formData}from'../../../lib/store';import{Ready}from'../../ready';export const dynamic='force-dynamic';export default function Page(){return <main className="p-4 sm:p-8"><Ready/><LeadForm data={formData() as any}/></main>}`);
write("app/leads/[leadId]/page.tsx", `import{LeadDetail}from'@/modules/leads/components/lead-detail';import{LeadPropertyPanel}from'@/modules/leads/components/lead-property-panel';import{detailData,propertyData}from'../../../lib/store';import{Ready}from'../../ready';export const dynamic='force-dynamic';export default async function Page({params}:{params:Promise<{leadId:string}>}){const{leadId}=await params;return <main className="p-4 sm:p-8"><Ready/><LeadDetail data={detailData(leadId) as any} propertySection={<LeadPropertyPanel leadId={leadId} initialData={propertyData(leadId) as any}/>}/></main>}`);
write("app/leads/[leadId]/edit/page.tsx", `import{LeadForm}from'@/modules/leads/components/lead-form';import{formData}from'../../../../lib/store';import{Ready}from'../../../ready';export const dynamic='force-dynamic';export default async function Page({params}:{params:Promise<{leadId:string}>}){const{leadId}=await params;return <main className="p-4 sm:p-8"><Ready/><LeadForm data={formData(leadId) as any}/></main>}`);
write("app/api/[...path]/route.ts", `import{respond}from'../../../lib/store';async function handle(request:Request,{params}:{params:Promise<{path:string[]}>}){return respond(request,(await params).path)}export{handle as GET,handle as POST,handle as PATCH};`);
write("app/fixture/route.ts", `import{store}from'../../lib/store';export function GET(){return Response.json(store)}export async function POST(request:Request){const body=await request.json();store.failNext=body.failNext===true;return Response.json({ok:true})}`);

const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
let server;
let worker;
let log = "";
let failure;
try {
  server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: fixture, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", data => { log = (log + data).slice(-12000); });
  server.stderr.on("data", data => { log = (log + data).slice(-12000); });
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error("Lead component fixture exited: " + log);
    try { if ((await fetch(url + "/leads", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* Still compiling. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Lead component fixture did not start: " + log);
  for (const [index, browser] of browsers.entries()) {
    worker = spawn(process.execPath, [join(root, "tests/leads-ui-browser.test.mjs"), url, browser, join(fixture, "browser-" + index)], { cwd: root, windowsHide: true, stdio: "inherit" });
    const code = await new Promise((resolve, reject) => { worker.once("error", reject); worker.once("exit", resolve); });
    if (code !== 0) throw new Error("Lead component browser checks failed. " + log.slice(-4000));
  }
} catch (error) {
  failure = error;
} finally {
  stop(worker);
  stop(server);
  const target = resolve(fixture);
  const scoped = relative(temporaryRoot, target);
  if (scoped && !scoped.startsWith("..") && !isAbsolute(scoped) && dirname(target) === resolve(temporaryRoot)) {
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 25, retryDelay: 300 });
    } catch (error) {
      if (!failure) failure = error;
      else console.warn(`Could not remove the isolated lead UI fixture at ${target}; the browser may still be releasing files.`);
    }
  }
}
if (failure) throw failure;
