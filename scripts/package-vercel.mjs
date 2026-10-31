import fs from 'node:fs/promises';
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','favicon.svg'])await fs.copyFile(file,'dist/'+file);
