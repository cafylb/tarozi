import Fastify, { type FastifyRequest, type HTTPMethods } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { z, type ZodType } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Config } from './config.js';
import { ApiError, clientFor, readOffers, unwrap } from './database.js';
import { channel, compareBasket, compareSchema, eligible, fairPrice, uuid } from './domain.js';
import * as s from './schemas.js';

declare module 'fastify' {
 interface FastifyRequest { db: SupabaseClient; accessToken?: string; actor?: User; }
}
type Access = { is_admin: boolean; seller_ids: string[] };
type Dependencies = { makeClient?: (token?: string)=>SupabaseClient; verifyUser?: (token:string)=>Promise<User> };

export async function buildApp(config: Config, dependencies: Dependencies = {}) {
 const app=Fastify({bodyLimit:256*1024,logger:process.env.NODE_ENV==='test'?false:{redact:['req.headers.authorization','req.body.password','req.body.refresh_token','res.headers.set-cookie']},trustProxy:false});
 const includeDemo=config.INCLUDE_DEMO_DATA==='true';
 const makeClient=dependencies.makeClient ?? ((token?:string)=>clientFor(config,token));
 await app.register(helmet);
 await app.register(cors,{origin:config.CORS_ORIGINS.split(',').map(v=>v.trim()),credentials:false});
 await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
 await app.register(swagger,{openapi:{openapi:'3.0.3',info:{title:'Tarozi grocery intelligence API',version:'0.1.0',description:'Category prices, supply information, restock estimates and seller tools. No checkout or orders.'},components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'Supabase access token'}}}}});
 // Initialized per request in onRequest before any handler runs.
 app.decorateRequest('db',null as unknown as SupabaseClient);
 app.decorateRequest('accessToken',undefined);app.decorateRequest('actor',undefined);
 app.addHook('onRequest',async req=>{
  const header=req.headers.authorization;
  if(header){if(!/^Bearer [^\s]+$/.test(header)) throw new ApiError(401,'unauthorized','Use an Authorization: Bearer access-token header.');req.accessToken=header.slice(7);}
  req.db=makeClient(req.accessToken);
 });
 app.setErrorHandler((err,req,reply)=>{
  if(err instanceof z.ZodError) return reply.code(400).send({error:{code:'validation_error',message:'Invalid request.',issues:err.issues.map(i=>({path:i.path,message:i.message}))}});
  if(err instanceof ApiError) return reply.code(err.status).send({error:{code:err.code,message:err.message}});
  if(err instanceof RangeError) return reply.code(422).send({error:{code:'calculation_limit',message:err.message}});
  if((err as {validation?:unknown}).validation) return reply.code(400).send({error:{code:'validation_error',message:'Invalid request.'}});
  const status=(err as {statusCode?:number}).statusCode;
  if(status && status>=400 && status<500) return reply.code(status).send({error:{code:status===429?'rate_limited':'invalid_request',message:status===429?'Too many requests. Try again later.':'Invalid request.'}});
  req.log.error({err},'Request failed');return reply.code(500).send({error:{code:'internal_error',message:'Unexpected server error.'}});
 });
 async function authenticate(req:FastifyRequest){
  if(!req.accessToken) throw new ApiError(401,'unauthorized','Sign in to continue.');
  if(dependencies.verifyUser) req.actor=await dependencies.verifyUser(req.accessToken);
  else {
   const {data,error}=await req.db.auth.getUser(req.accessToken);
   if(error || !data.user) throw new ApiError(401,'unauthorized','Invalid or expired session.');
   req.actor=data.user;
  }
 }
 async function access(req:FastifyRequest):Promise<Access>{return unwrap(await req.db.rpc('my_access')) as Access;}
 async function admin(req:FastifyRequest){await authenticate(req);if(!(await access(req)).is_admin)throw new ApiError(403,'forbidden','Administrator access required.');}
 function route(method:HTTPMethods,url:string,summary:string,handler:(req:FastifyRequest)=>unknown,opts:{auth?:boolean;admin?:boolean;body?:ZodType;query?:ZodType;authLimit?:boolean}={}){
  app.route({method,url,schema:{summary,tags:[url.split('/')[1]??'api'],...(opts.auth||opts.admin?{security:[{bearerAuth:[]}]}:{}),...(opts.body?{body:z.toJSONSchema(opts.body,{target:'draft-7',unrepresentable:'any'})}:{}),...(opts.query?{querystring:z.toJSONSchema(opts.query,{target:'draft-7',unrepresentable:'any'})}:{})},
   config:opts.authLimit?{rateLimit:{max:8,timeWindow:'1 minute'}}:undefined,
   preHandler:opts.admin?admin:opts.auth?authenticate:undefined,
   handler:async req=>handler(req)});
 }
 const id=(req:FastifyRequest)=>uuid.parse((req.params as Record<string,string>).id);
 const paged=z.object({limit:z.coerce.number().int().min(1).max(100).default(30),offset:z.coerce.number().int().min(0).max(10000).default(0)});
 const offersQuery=paged.extend({product_id:uuid.optional(),category_id:uuid.optional(),seller_id:uuid.optional(),channel:channel.default('retail'),district:z.string().max(80).optional(),max_age_hours:z.coerce.number().positive().max(168).default(24),include_stale:z.enum(['true','false']).default('false')});
 const filter=(q:{channel?:string;district?:string})=>({includeDemo,channel:q.channel,district:q.district});

 route('GET','/health','Process liveness',()=>({status:'ok',service:'tarozi',version:'0.1.0',database:'Supabase/PostgreSQL'}));
 route('GET','/ready','Database/schema readiness',async req=>{unwrap(await req.db.from('categories').select('id').limit(1));return {status:'ready'};});
 route('GET','/openapi.json','OpenAPI specification',()=>app.swagger());

 route('POST','/auth/register','Register; verification email handled by Supabase',async req=>{
  const body=s.signupSchema.parse(req.body);const {data,error}=await req.db.auth.signUp({email:body.email,password:body.password,options:{data:{display_name:body.display_name},emailRedirectTo:config.AUTH_REDIRECT_URL}});
  if(error)throw new ApiError(400,'registration_failed','Registration could not be completed. Check email, password and verification settings.');
  return {user:data.user?{id:data.user.id,email:data.user.email}:null,session:data.session,verification_required:!data.session};
 },{body:s.signupSchema,authLimit:true});
 route('POST','/auth/login','Sign in with email and password',async req=>{
  const result=await req.db.auth.signInWithPassword(s.authCredentials.parse(req.body));
  if(result.error)throw new ApiError(401,'login_failed','Invalid credentials or email not verified.');
  return {user:{id:result.data.user.id,email:result.data.user.email},session:result.data.session};
 },{body:s.authCredentials,authLimit:true});
 route('POST','/auth/refresh','Rotate a refresh token',async req=>{
  const result=await req.db.auth.refreshSession(s.refreshSchema.parse(req.body));
  if(result.error)throw new ApiError(401,'refresh_failed','Session cannot be refreshed. Sign in again.');return {session:result.data.session};
 },{body:s.refreshSchema,authLimit:true});
 route('POST','/auth/verify','Exchange an email token hash for a session',async req=>{
  const body=z.object({token_hash:z.string().min(10).max(1000),type:z.enum(['signup','recovery','email'])}).strict().parse(req.body);
  const result=await req.db.auth.verifyOtp(body);if(result.error)throw new ApiError(401,'verification_failed','Verification link is invalid or expired.');return {session:result.data.session};
 },{body:z.object({token_hash:z.string().min(10),type:z.enum(['signup','recovery','email'])}),authLimit:true});
 route('POST','/auth/reset-password','Request password recovery without revealing account existence',async req=>{
  const {email}=s.resetSchema.parse(req.body);await req.db.auth.resetPasswordForEmail(email,{redirectTo:config.AUTH_REDIRECT_URL});
  return {message:'If that account exists, a recovery email will be sent.'};
 },{body:s.resetSchema,authLimit:true});
 route('PUT','/auth/password','Set a password using a verified current or recovery session',async req=>{
  const body=s.passwordSchema.parse(req.body);
  const response=await fetch(`${config.SUPABASE_URL}/auth/v1/user`,{method:'PUT',headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${req.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw new ApiError(400,'password_update_failed','Password update failed. Obtain a valid recovery session or reauthenticate.');return {updated:true};
 },{auth:true,body:s.passwordSchema,authLimit:true});
 route('POST','/auth/logout','Revoke this refresh session; client must discard access tokens',async req=>{
  const response=await fetch(`${config.SUPABASE_URL}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${req.accessToken}`}});
  if(!response.ok)throw new ApiError(400,'logout_failed','Could not revoke the session.');
  return {signed_out:true,note:'Discard local tokens. Already-issued access tokens remain valid until expiry.'};
 },{auth:true,authLimit:true});

 route('GET','/me','Profile and database-backed account access',async req=>({profile:unwrap(await req.db.from('profiles').select('*').eq('id',req.actor!.id).single()),access:await access(req)}),{auth:true});
 route('PATCH','/me','Update profile; never grants seller/admin privileges',async req=>({profile:unwrap(await req.db.from('profiles').update(s.profileSchema.parse(req.body)).eq('id',req.actor!.id).select().single())}),{auth:true,body:s.profileSchema});
 route('GET','/categories','Category sidebar',async req=>({data:unwrap(await req.db.from('categories').select('*').order('sort_order'))}));
 const productsQuery=paged.extend({category_id:uuid.optional(),q:z.string().trim().max(100).optional()});
 route('GET','/products','Search products with exact brand, grade and variants',async req=>{
  const q=productsQuery.parse(req.query);let query=req.db.from('products').select('*,variants(*)',{count:'exact'}).eq('active',true).order('name').order('id');
  if(q.category_id)query=query.eq('category_id',q.category_id);if(q.q)query=query.ilike('name',`%${q.q.replace(/[%_]/g,'')}%`);
  const result=await query.range(q.offset,q.offset+q.limit-1);return {data:unwrap(result),total:result.count,limit:q.limit,offset:q.offset};
 },{query:productsQuery});
 route('GET','/products/:id','Exact product and available pack variants',async req=>({data:unwrap(await req.db.from('products').select('*,variants(*)').eq('id',id(req)).single())}));
 route('GET','/sellers','Approved sellers and branches',async req=>{
  const q=paged.parse(req.query);let query=req.db.from('sellers').select('*,branches(*)').eq('verification_status','approved').order('name').order('id');
  if(!includeDemo)query=query.eq('is_demo',false);return {data:unwrap(await query.range(q.offset,q.offset+q.limit-1))};
 },{query:paged});
 route('GET','/offers','Comparable offers; expired data only when explicitly requested',async req=>{
  const q=offersQuery.parse(req.query);const rows=await readOffers(req.db,{...filter(q),productIds:q.product_id?[q.product_id]:undefined,categoryId:q.category_id,sellerId:q.seller_id});
  const annotated=rows.map(o=>({...o,current:eligible(o,new Date(),q.max_age_hours,includeDemo),unit_price_uzs:o.price_uzs/o.pack_quantity}));
  const visible=q.include_stale==='true'?annotated:annotated.filter(o=>o.current);
  visible.sort((a,b)=>a.unit_price_uzs-b.unit_price_uzs||a.id.localeCompare(b.id));
  return {data:visible.slice(q.offset,q.offset+q.limit),total:visible.length,price_basis:'UZS per displayed pack, tax included by supplier declaration; unit price is a comparison aid',include_demo:includeDemo};
 },{query:offersQuery});
 const benchmarkQuery=z.object({channel,district:z.string().min(1).max(80),max_age_hours:z.coerce.number().positive().max(168).default(24)});
 route('GET','/products/:id/fair-price','Median of fresh comparable offers; at least three distinct sellers',async req=>{
  const q=benchmarkQuery.parse(req.query);return fairPrice(await readOffers(req.db,{...filter(q),productIds:[id(req)]}),new Date(),includeDemo,q.max_age_hours);
 },{query:benchmarkQuery});
 route('GET','/offers/:id/history','Immutable offer observations with source and validity',async req=>{
  const q=paged.parse(req.query);return {data:unwrap(await req.db.from('price_observations').select('*').eq('offer_id',id(req)).order('offer_version',{ascending:false}).range(q.offset,q.offset+q.limit-1))};
 },{query:paged});
 route('POST','/advisor/compare','Explain complete and split restock estimates',async req=>{
  const body=compareSchema.parse(req.body);return compareBasket(body,await readOffers(req.db,{...filter(body),productIds:body.items.map(i=>i.product_id)}),new Date(),includeDemo);
 },{body:compareSchema});

 route('POST','/seller/apply','Apply as a seller; approval is required before publishing',async req=>({data:unwrap(await req.db.from('sellers').insert({...s.sellerSchema.parse(req.body),created_by:req.actor!.id}).select().single())}),{auth:true,body:s.sellerSchema});
 route('GET','/seller/dashboard','Own sellers, branches and offers',async req=>{
  const a=await access(req);if(!a.seller_ids.length)return {sellers:[],branches:[],offers:[]};
  const sellers=unwrap(await req.db.from('sellers').select('*').in('id',a.seller_ids));
  const branches=unwrap(await req.db.from('branches').select('*').in('seller_id',a.seller_ids));
  const offers=branches.length?unwrap(await req.db.from('offers').select('*').in('branch_id',branches.map(b=>b.id)).limit(1000)):[];
  return {sellers,branches,offers,offer_limit:1000};
 },{auth:true});
 route('POST','/seller/branches','Create an owned branch after approval',async req=>({data:unwrap(await req.db.from('branches').insert(s.branchSchema.parse(req.body)).select().single())}),{auth:true,body:s.branchSchema});
 route('POST','/seller/offers','Publish a price; database creates historical observation',async req=>({data:unwrap(await req.db.from('offers').insert({...s.offerWriteSchema.parse(req.body),source_type:'seller'}).select().single())}),{auth:true,body:s.offerWriteSchema});
 route('PATCH','/seller/offers/:id','Update an owned price/availability; never overwrite history',async req=>({data:unwrap(await req.db.from('offers').update(s.offerPatchSchema.parse(req.body)).eq('id',id(req)).select().single())}),{auth:true,body:s.offerPatchSchema});

 route('GET','/favorites','Own saved products',async req=>({data:unwrap(await req.db.from('favorites').select('*,products(*)').order('created_at',{ascending:false}))}),{auth:true});
 route('PUT','/favorites/:id','Save a product',async req=>({data:unwrap(await req.db.from('favorites').upsert({user_id:req.actor!.id,product_id:id(req)},{onConflict:'user_id,product_id'}).select())}),{auth:true});
 route('DELETE','/favorites/:id','Remove own favorite',async req=>{unwrap(await req.db.from('favorites').delete().eq('user_id',req.actor!.id).eq('product_id',id(req)));return {removed:true};},{auth:true});
 route('GET','/lists','Own saved restock lists',async req=>({data:unwrap(await req.db.from('shopping_lists').select('*,shopping_list_items(*)').order('updated_at',{ascending:false}))}),{auth:true});
 route('POST','/lists','Save a list and lines in one database transaction',async req=>({id:unwrap(await req.db.rpc('save_shopping_list',{payload:s.savedListSchema.parse(req.body)}))}),{auth:true,body:s.savedListSchema});
 route('DELETE','/lists/:id','Delete an owned saved list',async req=>{const data=unwrap(await req.db.from('shopping_lists').delete().eq('id',id(req)).select('id'));if(!data.length)throw new ApiError(404,'not_found','List not found.');return {removed:true};},{auth:true});
 route('GET','/alerts','Own target-price rules',async req=>({data:unwrap(await req.db.from('alerts').select('*').order('created_at',{ascending:false}))}),{auth:true});
 route('POST','/alerts','Create a price alert; unit target is UZS per product base unit',async req=>{
  const body=s.alertSchema.parse(req.body);if(body.include_demo&&!includeDemo)throw new ApiError(400,'demo_disabled','Demo alerts are disabled.');
  const data=unwrap(await req.db.from('alerts').insert({...body,user_id:req.actor!.id}).select().single());
  unwrap(await req.db.rpc('evaluate_my_alerts'));return {data};
 },{auth:true,body:s.alertSchema});
 route('DELETE','/alerts/:id','Delete an owned alert',async req=>{unwrap(await req.db.from('alerts').delete().eq('id',id(req)));return {removed:true};},{auth:true});
 route('POST','/alerts/evaluate','Evaluate caller alerts; idempotent per observed offer version',async req=>({created:unwrap(await req.db.rpc('evaluate_my_alerts'))}),{auth:true});
 route('GET','/notifications','Refresh and read own in-app price alerts',async req=>{
  const q=paged.parse(req.query);unwrap(await req.db.rpc('evaluate_my_alerts'));
  return {data:unwrap(await req.db.from('notifications').select('*').order('created_at',{ascending:false}).range(q.offset,q.offset+q.limit-1))};
 },{auth:true,query:paged});
 route('PATCH','/notifications/:id/read','Mark own notification as read',async req=>({data:unwrap(await req.db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id(req)).select().single())}),{auth:true});
 route('POST','/reports','Report a suspicious or incorrect offer',async req=>({data:unwrap(await req.db.from('price_reports').insert({...s.reportSchema.parse(req.body),user_id:req.actor!.id}).select().single())}),{auth:true,body:s.reportSchema});
 route('POST','/interest','Record a product interest signal, not a purchase',async req=>{const body=z.object({product_id:uuid}).strict().parse(req.body);unwrap(await req.db.from('search_events').insert({...body,user_id:req.actor!.id}));return {recorded:true,evidence:'interest_not_sales'};},{auth:true,body:z.object({product_id:uuid})});
 route('GET','/market/signals','Approved-seller aggregate interest; groups under five users suppressed',async req=>unwrap(await req.db.rpc('market_signals')),{auth:true});

 route('GET','/admin/sellers','Review seller applications',async req=>({data:unwrap(await req.db.from('sellers').select('*').order('created_at',{ascending:false}).limit(200))}),{admin:true});
 const verification=z.object({verification_status:z.enum(['approved','rejected','suspended'])}).strict();
 route('PATCH','/admin/sellers/:id/verification','Approve/reject/suspend seller with audit history',async req=>({data:unwrap(await req.db.from('sellers').update(verification.parse(req.body)).eq('id',id(req)).select().single())}),{admin:true,body:verification});
 route('POST','/admin/categories','Create category',async req=>({data:unwrap(await req.db.from('categories').insert(s.categorySchema.parse(req.body)).select().single())}),{admin:true,body:s.categorySchema});
 route('POST','/admin/products','Create canonical product identity',async req=>({data:unwrap(await req.db.from('products').insert(s.productSchema.parse(req.body)).select().single())}),{admin:true,body:s.productSchema});
 route('POST','/admin/variants','Create exact pack variant',async req=>({data:unwrap(await req.db.from('variants').insert(s.variantSchema.parse(req.body)).select().single())}),{admin:true,body:s.variantSchema});
 route('GET','/admin/reports','Review price reports',async req=>({data:unwrap(await req.db.from('price_reports').select('*').eq('status','open').order('created_at').limit(200))}),{admin:true});
 route('GET','/admin/audit','Read bounded immutable moderation and price-change audit',async req=>({data:unwrap(await req.db.rpc('admin_audit_log',{row_limit:50}))}),{admin:true});
 const reportStatus=z.object({status:z.enum(['reviewed','dismissed'])}).strict();
 route('PATCH','/admin/reports/:id','Resolve a price report',async req=>({data:unwrap(await req.db.from('price_reports').update(reportStatus.parse(req.body)).eq('id',id(req)).select().single())}),{admin:true,body:reportStatus});
 const previewSchema=z.object({rows:z.array(z.unknown()).min(1).max(200)});
 route('POST','/admin/imports/preview','Validate rows before reviewed publication',req=>{
  const body=previewSchema.parse(req.body);const rows=body.rows.map((r,index)=>{const parsed=s.offerWriteSchema.safeParse(r);return parsed.success?{row:index+1,valid:true,data:parsed.data}:{row:index+1,valid:false,issues:parsed.error.issues.map(i=>({path:i.path,message:i.message}))};});
  return {ready:rows.every(r=>r.valid),rows};
 },{admin:true,body:previewSchema});
 const publishSchema=z.object({reviewed:z.literal(true),rows:z.array(s.offerWriteSchema).min(1).max(200)}).strict();
 route('POST','/admin/imports/publish','Atomically publish an explicitly reviewed import',async req=>{const body=publishSchema.parse(req.body);return {published:unwrap(await req.db.rpc('publish_price_import',{rows:body.rows}))};},{admin:true,body:publishSchema});
 return app;
}
