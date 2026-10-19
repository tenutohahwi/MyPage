# 기존 Vercel 관리자에 로그인·직접 전송 연결

운영 주소: https://tenutohahwi.vercel.app/admin/

MyPage 저장소의 기존 관리자 화면에 관리자 Google 로그인과 직접 전송 버튼을 추가했습니다. Vercel `mypage` 프로젝트의 저장소·Root Directory·도메인을 바꾸거나 별도 프로젝트를 만들 필요가 없습니다. 변경 브랜치를 운영 브랜치에 병합해 자동 배포한 뒤 아래 설정을 합니다.

## 1. 기존 Vercel 프로젝트에 서버 키 추가

1. Vercel에서 기존 `mypage` 프로젝트를 엽니다.
2. Settings → Environment Variables → Add Environment Variable.
3. Key: `FIREBASE_SERVICE_ACCOUNT`
4. Value: Firebase `littlemakes-16ea4` 서버용 서비스 계정 JSON **전체 내용** (`{`부터 `}`까지). 바깥 따옴표를 추가하지 않습니다.
5. Environment: Production. Preview 테스트가 필요할 때만 Preview에도 추가합니다.
6. Save 후 Deployments에서 운영 브랜치의 최신 배포를 Redeploy합니다. 로그인·API 변경이 포함된 커밋인지 확인합니다.

서비스 계정 키는 Firebase 프로젝트 설정 → 서비스 계정에서 준비합니다. 가능하면 발송 전용 서비스 계정에 `Firebase Cloud Messaging API Admin` 역할만 부여합니다. FCM HTTP v1 API도 활성화되어 있어야 합니다. `google-services.json`과 다릅니다. 서비스 계정 JSON은 Vercel 환경변수에만 넣고 GitHub·웹 입력란·채팅에는 올리지 않습니다. GitHub Secrets는 필요 없습니다.

## 2. Firebase에서 Google 로그인 허용

1. Firebase `littlemakes-16ea4` → Authentication → Sign-in method → Google을 활성화합니다.
2. Authentication → Settings → Authorized domains에 `tenutohahwi.vercel.app`을 추가합니다. `https://`나 `/admin/`을 붙이지 않습니다.
3. 운영 주소에서 관리자 Google 로그인 → `tenutohahwi@gmail.com` 선택.

로그인 팝업이 차단되면 허용합니다. 서버도 Firebase에 토큰을 조회해 검증된 관리자 이메일과 사용 중지 여부를 확인합니다. 다른 계정은 로그인해도 전송하지 못합니다.

## 3. 발송 확인

기존처럼 추천 앱테크 또는 이벤트를 작성하고 `내용 확인·전송`을 누릅니다. 확인 창의 `구독자에게 전송`은 실제 `events` 주제 구독자 전체에게 발송합니다.

- 이벤트: 한국 시간 기준 3~5분 뒤 일정으로 테스트합니다. data-only 메시지를 수신하면 Android 앱이 일정을 자동 등록합니다. 앱을 홈으로 내린 상태에서 전송 후 알림을 누르지 않고 앱 아이콘으로 열어 일정 등록과 지정 시각 알림을 확인합니다.
- 추천 앱: 기존 알림+맞춤 데이터 형식입니다. 포그라운드에서는 즉시 저장하고, 백그라운드에서는 사용자가 알림을 눌러야 추천 변경이 반영됩니다.
- FCM 접수 성공은 개별 기기의 수신 확인이 아닙니다. 강제 종료·오프라인·절전·권한에 따라 지연되거나 수신하지 못할 수 있습니다.
- 같은 이벤트 작성 내용은 요청 ID를 유지해 중복 일정을 방지합니다. 서버 영속 저장소는 없으므로 응답 오류 시 휴대폰을 먼저 확인하세요.

초안·작성 목록은 기존처럼 이 브라우저에 보관합니다. 콘솔용 복사와 콘솔 열기도 사용할 수 있습니다. 홈페이지·개인정보 페이지·app-ads.txt는 기존 파일을 유지합니다.

## 검증

Node.js 22 이상에서 `npm test`. 실제 Firebase 로그인·Vercel 발송·휴대폰 수신은 운영 환경변수와 승인 도메인 설정 후 확인해야 합니다. `npm run preview`는 정적 화면 확인 전용이며 서버 API를 실행하지 않습니다.

공식 문서: [Vercel 환경변수](https://vercel.com/docs/environment-variables), [Firebase Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api).
