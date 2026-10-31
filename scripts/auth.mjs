import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv, promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
const derive = promisify(scrypt);
export async function createAuth(root, port) {
  let config = {};
  try { config = parseEnv(await fs.readFile(path.join(root, '.env.local'), 'utf8')); } catch {}
  config = { ...config, ...process.env };
  const origin = config.APP_URL || `http://localhost:${port}`;
  const redirect = `${origin}/api/auth/google/callback`;
  const google = config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET ? new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, redirect) : null;
  const filename = path.join(root, '.local', 'accounts.json');
  let users = [];
  try { users = JSON.parse(await fs.readFile(filename, 'utf8')); } catch(error) { if(error.code !== 'ENOENT') throw error; }
  const sessions = new Map(), pending = new Map(), attempts = new Map();
  const persist = async () => { await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename + '.tmp', JSON.stringify(users)); await fs.rename(filename + '.tmp', filename); };
  let queue = Promise.resolve();
  const mutate = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
  const safe = user => user ? { id:user.id, name:user.name, email:user.email, store:user.store || '', provider:user.provider } : null;
  const cookie = (name, value, maxAge) => `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${origin.startsWith('https:')?'; Secure':''}`;
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(part=>part.trim().split('=')));
  function session(req) { const token=cookies(req).tarozi_session; const value=sessions.get(token); if(!value || value.expires<Date.now()) { sessions.delete(token); return null; } return users.find(user=>user.id===value.id); }
  function establish(res, user) { const token=randomBytes(32).toString('hex'); sessions.set(token,{id:user.id,expires:Date.now()+7*86400000}); res.setHeader('Set-Cookie',cookie('tarozi_session',token,7*86400)); }
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  async function body(req) { let text=''; for await(const chunk of req) { text+=chunk; if(text.length>16384) throw new Error('BODY_TOO_LARGE'); } return JSON.parse(text || '{}'); }
  return async function handleAuth(req,res,url) {
    if(!url.pathname.startsWith('/api/auth/'))return false;
    res.setHeader('Cache-Control','no-store');
    try {
      if(req.method==='GET' && url.pathname==='/api/auth/session') {json(res,200,{user:safe(session(req)),googleEnabled:!!google});return true;}
      if(req.method==='GET' && url.pathname==='/api/auth/google') {
        if(!google){json(res,503,{error:'GOOGLE_NOT_CONFIGURED'});return true;}
        const state=randomBytes(32).toString('hex'), verifier=randomBytes(32).toString('base64url');
        pending.set(state,{verifier,expires:Date.now()+600000});
        for(const [key,value] of pending)if(value.expires<Date.now())pending.delete(key);
        res.setHeader('Set-Cookie',cookie('tarozi_oauth',state,600));
        const target=google.generateAuthUrl({scope:['openid','email','profile'],state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
        res.writeHead(302,{Location:target});res.end();return true;
      }
      if(req.method==='GET' && url.pathname==='/api/auth/google/callback') {
        const state=url.searchParams.get('state'), flow=pending.get(state);
        pending.delete(state);
        res.setHeader('Set-Cookie',cookie('tarozi_oauth','',0));
        if(!google || !flow || flow.expires<Date.now() || cookies(req).tarozi_oauth!==state || !url.searchParams.get('code')) {res.writeHead(302,{Location:'/?auth=failed'});res.end();return true;}
        const {tokens}=await google.getToken({code:url.searchParams.get('code'),codeVerifier:flow.verifier,redirect_uri:redirect});
        const ticket=await google.verifyIdToken({idToken:tokens.id_token,audience:config.GOOGLE_CLIENT_ID});
        const identity=ticket.getPayload();
        if(!identity?.sub || !identity.email_verified)throw new Error('IDENTITY_INVALID');
        const user=await mutate(async()=>{let user=users.find(u=>u.provider==='google' && u.subject===identity.sub);if(!user){user={id:randomBytes(16).toString('hex'),provider:'google',subject:identity.sub,name:identity.name||identity.email,email:identity.email,store:''};users.push(user);await persist();}return user;});
        establish(res,user);res.writeHead(302,{Location:'/?auth=success'});res.end();return true;
      }
      if(req.method!=='POST'){json(res,405,{error:'METHOD_NOT_ALLOWED'});return true;}
      if(req.headers.origin!==origin){json(res,403,{error:'INVALID_ORIGIN'});return true;}
      const ip=req.socket.remoteAddress, now=Date.now(); let limit=attempts.get(ip);
      if(!limit || limit.until<now)limit={count:0,until:now+60000};limit.count++;attempts.set(ip,limit);
      if(limit.count>30){json(res,429,{error:'TRY_LATER'});return true;}
      if(url.pathname==='/api/auth/logout'){sessions.delete(cookies(req).tarozi_session);res.setHeader('Set-Cookie',cookie('tarozi_session','',0));json(res,200,{ok:true});return true;}
      const data=await body(req);
      if(url.pathname==='/api/auth/profile') {
        const user=session(req);if(!user){json(res,401,{error:'UNAUTHORIZED'});return true;}
        if(!String(data.name||'').trim()){json(res,400,{error:'NAME_REQUIRED'});return true;}
        await mutate(async()=>{user.name=String(data.name).trim().slice(0,80);user.store=String(data.store||'').trim().slice(0,100);await persist();});
        json(res,200,{user:safe(user)});return true;
      }
      const email=String(data.email||'').trim().toLowerCase(), password=String(data.password||'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length>128){json(res,400,{error:'INVALID_INPUT'});return true;}
      if(url.pathname==='/api/auth/register') {
        if(password.length<8||!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password)){json(res,400,{error:'WEAK_PASSWORD'});return true;}
        const user=await mutate(async()=>{if(users.some(u=>u.email===email&&u.provider==='email'))return null;const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');const user={id:randomBytes(16).toString('hex'),provider:'email',email,name:String(data.name||email.split('@')[0]).slice(0,80),salt,hash,store:''};users.push(user);await persist();return user;});
        if(!user){json(res,409,{error:'EMAIL_EXISTS'});return true;}establish(res,user);json(res,200,{user:safe(user)});return true;
      }
      if(url.pathname==='/api/auth/login') {
        const user=users.find(u=>u.provider==='email'&&u.email===email);
        const actual=await derive(password,user?.salt||'dummy-salt',64);
        if(!user||!timingSafeEqual(actual,Buffer.from(user.hash,'hex'))){json(res,401,{error:'INVALID_CREDENTIALS'});return true;}
        establish(res,user);json(res,200,{user:safe(user)});return true;
      }
      json(res,404,{error:'NOT_FOUND'});
    }catch{ if(url.pathname.endsWith('/callback')){res.writeHead(302,{Location:'/?auth=failed'});res.end();}else json(res,500,{error:'AUTH_FAILED'}); }
    return true;
  };
}
