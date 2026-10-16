import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {createHandler} from '../lib/handler.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const api=createHandler({env:{ADMIN_SEND_ENABLED:'false'}});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/admin'){
   const response=await api(new Request('http://localhost:4173'+path,{method:req.method}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  const target=resolve(root,'.'+decodeURIComponent(path.endsWith('/')?path+'index.html':path));
  if(!target.startsWith(root+sep)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end();return;}
  if(!path.startsWith('/admin/')&&!path.startsWith('/assets/')&&!['/','/index.html','/style.css','/privacy.html','/app-ads.txt'].includes(path)){res.writeHead(404);res.end();return;}
  const bytes=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173/admin/ (sending disabled)'));
