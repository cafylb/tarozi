import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {products} from '../prototypes/style-lab/model.mjs';

export async function createCommerce(root,{session,users,mutate,persist,json,origin}){
 const file=path.join(root,'.local','market-events.json');
 let events=[];try{events=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 let eventQueue=Promise.resolve();const limits=new Map();
 const catalog=()=>users.flatMap(user=>(user.items||[]).map(item=>({...item,storeId:user.id,store:user.store||user.name,address:user.address||'',lat:user.lat,lng:user.lng})));
 const safeStore=user=>({id:user.id,name:user.store||user.name,address:user.address||'',lat:user.lat,lng:user.lng});
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/market/')&&!url.pathname.startsWith('/api/seller/'))return false;
  const reply=(status,value)=>{json(res,status,value);return true;};
  try{
   if(req.method==='GET'&&url.pathname==='/api/market/catalog')return reply(200,{items:catalog().filter(item=>item.stock>0),stores:users.filter(user=>user.role==='seller').map(safeStore)});
   const user=session(req);
   if(url.pathname.startsWith('/api/seller/')&&(!user||user.role!=='seller'))return reply(user?403:401,{error:'SELLER_REQUIRED'});
   if(req.method==='GET'&&url.pathname==='/api/seller/items')return reply(200,{items:user.items||[]});
   if(req.method==='GET'&&url.pathname==='/api/seller/analytics'){
    const days=Array.from({length:30},(_,index)=>new Date(Date.now()-(29-index)*86400000).toISOString().slice(0,10));
    const recent=events.filter(event=>event.day>=days[0]);
    return reply(200,{days,searches:days.map(day=>recent.filter(event=>event.day===day&&event.type==='search').length),demand:products.map(product=>({productId:product.id,count:recent.filter(event=>event.productId===product.id&&event.type==='search').length})),items:(user.items||[]).map(item=>({id:item.id,views:recent.filter(event=>event.itemId===item.id&&event.type==='view').length,searches:recent.filter(event=>event.productId===item.productId&&event.type==='search').length})),views:days.map(day=>recent.filter(event=>event.day===day&&event.type==='view'&&(user.items||[]).some(item=>item.id===event.itemId)).length)});
   }
   if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
   if(req.headers.origin!==origin)return reply(403,{error:'INVALID_ORIGIN'});
   const ip=req.socket.remoteAddress,now=Date.now();let limit=limits.get(ip);if(!limit||limit.until<now)limit={count:0,until:now+60000};limits.set(ip,limit);if(++limit.count>120)return reply(429,{error:'TRY_LATER'});
   let text='';for await(const chunk of req){text+=chunk;if(text.length>16000)return reply(413,{error:'BODY_TOO_LARGE'});}let data;try{data=JSON.parse(text);}catch{return reply(400,{error:'INVALID_INPUT'});}
   if(url.pathname==='/api/market/event'){
    if(!products.some(product=>product.id===data.productId)||!['search','view'].includes(data.type))return reply(400,{error:'INVALID_INPUT'});
    if(data.type==='view'&&!catalog().some(item=>item.id===data.itemId&&item.productId===data.productId))return reply(400,{error:'INVALID_ITEM'});
    const event={type:data.type,productId:data.productId,itemId:data.type==='view'?data.itemId:undefined,day:new Date().toISOString().slice(0,10)};
    eventQueue=eventQueue.catch(()=>{}).then(async()=>{events=events.filter(item=>item.day>=new Date(Date.now()-30*86400000).toISOString().slice(0,10));events.push(event);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(events));await fs.rename(file+'.tmp',file);});await eventQueue;
    return reply(200,{ok:true});
   }
   if(url.pathname==='/api/seller/store'){
    if(!String(data.store||'').trim()||!String(data.address||'').trim()||!Number.isFinite(data.lat)||!Number.isFinite(data.lng)||data.lat<41.15||data.lat>41.5||data.lng<69.05||data.lng>69.55)return reply(400,{error:'INVALID_STORE'});
    await mutate(async()=>{Object.assign(user,{store:String(data.store).trim().slice(0,100),address:String(data.address).trim().slice(0,180),lat:data.lat,lng:data.lng});await persist();});return reply(200,{store:safeStore(user)});
   }
   if(url.pathname==='/api/seller/items'){
    const product=products.find(product=>product.id===data.productId);
    if(!product||!String(data.name||'').trim()||!Number.isInteger(data.price)||data.price<1||data.price>1e9||!Number.isInteger(data.stock)||data.stock<0||data.stock>1e7)return reply(400,{error:'INVALID_PRODUCT'});
    let item;await mutate(async()=>{user.items||=[];if(data.id){item=user.items.find(item=>item.id===data.id);if(!item)return;}else{if(user.items.length>=100)return;item={id:randomUUID(),createdAt:new Date().toISOString()};user.items.push(item);}if(item.productId!==product.id)item.history=[];item.history||=[];if(item.price!==data.price)item.history.push({date:new Date().toISOString(),price:data.price});item.history=item.history.slice(-100);Object.assign(item,{name:String(data.name).trim().slice(0,100),productId:product.id,price:data.price,stock:data.stock,unit:product.unit,updatedAt:new Date().toISOString()});await persist();});return item?reply(200,{item}):reply(404,{error:'ITEM_NOT_FOUND'});
   }
   return reply(404,{error:'NOT_FOUND'});
  }catch{return reply(500,{error:'SAVE_FAILED'});}
 };
}
