import {firebaseConfig} from './firebase-config.js';
const OWNER='tenutohahwi@gmail.com';
// Keep the editor usable if loading Firebase or browser session storage fails.
export async function connectAuth(onChange,onError){
 const [{initializeApp},sdk]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
 ]);
 const auth=sdk.getAuth(initializeApp(firebaseConfig));
 await sdk.setPersistence(auth,sdk.browserSessionPersistence);
 const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 const allowed=user=>!!user&&user.email===OWNER&&user.emailVerified;
 sdk.onAuthStateChanged(auth,user=>onChange({allowed:allowed(user),email:user?.email||''}));
 return {
  async login(){try{await sdk.signInWithPopup(auth,provider);}catch(e){
   const messages={
    'auth/unauthorized-domain':'Firebase Authentication의 승인된 도메인에 tenutohahwi.vercel.app을 추가하세요.',
    'auth/operation-not-allowed':'Firebase Authentication에서 Google 로그인을 활성화하세요.',
    'auth/popup-blocked':'브라우저에서 이 사이트의 팝업을 허용하고 다시 로그인하세요.',
    'auth/popup-closed-by-user':'로그인 창이 닫혔어요. 다시 눌러 로그인을 완료하세요.',
    'auth/cancelled-popup-request':'로그인 창이 이미 열려 있어요. 열린 창에서 계속하세요.',
    'auth/network-request-failed':'로그인 서버에 연결하지 못했어요. 인터넷 연결과 콘텐츠 차단 설정을 확인하세요.'
   };
   onError((messages[e.code]||'로그인을 완료하지 못했어요. 새로고침 후 다시 시도하세요.')+' ('+(e.code||'unknown')+')');
  }},
  async logout(){try{await sdk.signOut(auth);}catch{onError('로그아웃하지 못했어요. 다시 시도하세요.');}},
  async token(){if(!allowed(auth.currentUser))throw Error('관리자 Google 계정으로 로그인하세요.');return auth.currentUser.getIdToken();}
 };
}
