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
  async login(){try{await sdk.signInWithPopup(auth,provider);}catch{onError('로그인 실패. 팝업 허용과 Firebase Google 로그인·승인된 도메인 설정을 확인하세요.');}},
  async logout(){try{await sdk.signOut(auth);}catch{onError('로그아웃하지 못했어요. 다시 시도하세요.');}},
  async token(){if(!allowed(auth.currentUser))throw Error('관리자 Google 계정으로 로그인하세요.');return auth.currentUser.getIdToken();}
 };
}
