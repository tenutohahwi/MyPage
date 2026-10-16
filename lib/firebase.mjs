import {createSign,createVerify} from 'node:crypto';
import {PROJECT,OWNER} from './messages.mjs';
const CERTS='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache,certificateExpiry=0;
export async function verifyAdmin(token,{fetcher=fetch,now=Date.now()}={}){
 try{
  if(typeof token!=='string'||token.length>12000)return false;
  const parts=token.split('.');if(parts.length!==3)return false;
  const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
  const seconds=Math.floor(now/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)return false;
  if(claims.aud!==PROJECT||claims.iss!=='https://securetoken.google.com/'+PROJECT||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128)return false;
  if(!Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.iat)||claims.iat>seconds+60||!Number.isFinite(claims.auth_time)||claims.auth_time>seconds+60)return false;
  if(claims.email!==OWNER||claims.email_verified!==true)return false;
  if(!certificateCache||now>=certificateExpiry){
   const response=await fetcher(CERTS,{signal:AbortSignal.timeout(8000)});if(!response.ok)return false;
   certificateCache=await response.json();certificateExpiry=now+Math.min(3600,Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1])||300)*1000;
  }
  const certificate=Object.hasOwn(certificateCache,header.kid)?certificateCache[header.kid]:null;
  if(!certificate)return false;
  return createVerify('RSA-SHA256').update(parts[0]+'.'+parts[1]).verify(certificate,Buffer.from(parts[2],'base64url'));
 }catch{return false;}
}
export async function serviceToken(account,{fetcher=fetch,now=Date.now()}={}){
 if(account.project_id!==PROJECT||typeof account.client_email!=='string'||!account.private_key)throw Error('SERVICE_ACCOUNT');
 const time=Math.floor(now/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const assertion=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:time,exp:time+3600});
 const signature=createSign('RSA-SHA256').update(assertion).sign(account.private_key,'base64url');
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(8000),body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:assertion+'.'+signature})});
 if(!response.ok)throw Error('SERVICE_ACCOUNT');
 const token=(await response.json()).access_token;if(!token)throw Error('SERVICE_ACCOUNT');return token;
}
