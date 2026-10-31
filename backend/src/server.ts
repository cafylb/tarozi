import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config=loadConfig();
const app=await buildApp(config);
for(const signal of ['SIGTERM','SIGINT'] as const) process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
try {await app.listen({port:config.PORT,host:config.HOST});}
catch(error){app.log.error(error);process.exit(1);}
