import {Readable} from 'node:stream';
import {createAssistant} from '../scripts/assistant.mjs';

const assistants=new Map();
export default async function handler(req,res){
 const origin=`https://${req.headers.host}`;
 const incoming=new URL(req.url,origin);
 const route=incoming.searchParams.get('path');
 const url=new URL(route?'/api/'+route:incoming.pathname,origin);
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(url.pathname==='/api/auth/session'&&req.method==='GET')return json(200,{user:null,googleEnabled:false,demo:true});
 if(url.pathname==='/api/market/catalog'&&req.method==='GET')return json(200,{stores:[],items:[]});
 if(url.pathname==='/api/assistant'){
  let assistant=assistants.get(origin);if(!assistant){assistant=createAssistant(process.cwd(),0,{allowedOrigin:origin});assistants.set(origin,assistant);}
  // Vercel may parse JSON before invoking the function; the shared handler reads a stream.
  const stream=req.body===undefined?req:Readable.from([typeof req.body==='string'||Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body)]);
  Object.assign(stream,{method:req.method,headers:req.headers,socket:{remoteAddress:String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}});
  return assistant(stream,res,url);
 }
 if(url.pathname.startsWith('/api/auth/')||url.pathname.startsWith('/api/seller/'))return json(503,{error:'DEMO_SIGN_IN_ONLY'});
 return json(404,{error:'NOT_FOUND'});
}
