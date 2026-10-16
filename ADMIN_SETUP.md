# 줍줍이 웹 관리자 준비

기존 MyPage HTML 사이트에 `/admin/`과 Vercel Node.js 함수 `/api/admin`을 추가했습니다. Next.js 전환이나 새 DB는 필요하지 않습니다. 기본 홈·개인정보 페이지·app-ads.txt는 유지합니다.

## 지금 가능한 일
- 추천 앱 목록에서 선택하거나 새 앱 작성, 만보기형·출첵형 분류, 추천인 코드·선택 소개·설치 링크 입력
- 추가·수정·삭제 전송 미리보기와 항목별 키·값 복사 (Firebase 콘솔에서 사용)
- 이벤트 일정 작성 (한국 시간) 및 전송 미리보기
- 초안 저장·불러오기, 이 브라우저에서 접수한 최근 발송 이력
- 관리자 Google 로그인, 서버에서 관리자 ID 토큰 검증, FCM 발송 API

기본 앱은 우리동네GS, 건강의신, NH헬스케어, 라플레이, hy프레딧입니다. 웹 목록·초안·접수 이력은 이 브라우저에 보관하는 작성 자료이며, 사용자 기기의 현재 추천 목록을 조회하는 서버 동기화 기능은 없습니다. 다른 브라우저에서는 기본 목록으로 시작합니다.

## 로컬 확인
Node.js 22 이상에서 `npm test`, `npm run preview`를 실행한 다음 `http://127.0.0.1:4173/admin/`을 엽니다. 미리보기 서버는 실제 발송을 항상 차단합니다. Google 로그인은 Firebase 승인 도메인과 인터넷 연결이 필요합니다. Firebase 콘솔 키·값 복사와 초안 작성은 로그인 없이 가능합니다.

## Vercel 설정
1. MyPage Git 저장소에 변경을 반영하면 연결된 Vercel의 자동 배포가 실행될 수 있습니다. 발송은 기본적으로 비활성화되어 있으므로 환경변수를 설정하기 전에는 실제 전송되지 않습니다.
2. 기존 정적 사이트와 `/api` 함수가 함께 배포되도록 Framework Preset은 Other, 별도 Build Command와 Output Directory는 비워둡니다. Node.js 22.x를 사용합니다. 기존 프로젝트 설정에 따라 배포 결과를 확인해야 합니다.
3. Firebase Authentication에서 Google 로그인 방법을 켜고, 실제 Vercel 호스트 이름을 승인된 도메인에 추가합니다. 관리자 계정은 `tenutohahwi@gmail.com`이며 검증된 이메일만 허용합니다.
4. Firebase 프로젝트 `littlemakes-16ea4`에서 FCM 전송 권한이 있는 서비스 계정을 준비합니다. 전용 서비스 계정에는 `Firebase Cloud Messaging API Admin` 역할을 부여합니다. FCM HTTP v1 API도 켜져 있어야 합니다.
5. 서비스 계정 JSON 전체를 Vercel **서버 환경변수** `FIREBASE_SERVICE_ACCOUNT`에 저장합니다. 저장소·HTML·클라이언트 JS·NEXT_PUBLIC 환경변수에 넣지 않습니다. `.env.example`은 빈 설정 예시입니다.
6. `ADMIN_SEND_ENABLED=true`를 Production 환경변수에 설정하고 재배포합니다. 설정 전에는 전송 버튼이 비활성화됩니다. Preview 배포에서는 false로 유지하는 편이 좋습니다.
7. `/admin/`에서 관리자 계정으로 로그인합니다. 본인 기기에서 먼저 확인한 뒤 전체 구독자 대상으로 전송합니다. 이 UI의 발송 대상은 `events` 주제 전체로 고정되어 있습니다.

무료 이용 가능 여부는 Vercel의 개인·비상업용 조건과 사용량에 따릅니다. 이 구성은 Firebase Cloud Functions나 Blaze 전환을 요구하지 않습니다. Firebase 웹 설정은 공개 클라이언트 구성이고, 발송 권한은 서버의 서비스 계정과 관리자 토큰 검증으로 제한합니다.

## 전송 동작
- 추천 앱은 `app_action`, `app_name`, `app_type`, `app_url`, `referral_code`, `app_description`, 자동 `app_id`를 전송합니다. 삭제는 작업·링크·자동 ID만 보냅니다. 기존 앱을 선택하면 이름·링크를 바꿔도 ID가 유지됩니다.
- 추천 앱 푸시는 notification+data 형식입니다. 앱 실행 중에는 바로 반영되고 백그라운드에서는 알림을 눌러야 목록이 바뀝니다. 개별 기기의 수신 여부를 웹에서 확인할 수는 없습니다.
- 이벤트는 데이터 전용 푸시로 전송해 사용자 앱의 기존 eventId 수신 처리에서 일정을 저장합니다. OS 절전·강제 종료·네트워크 상태에 따라 수신이 지연되거나 누락될 수 있습니다.
- API 응답 성공은 FCM 발송 접수입니다. 기기 전체의 수신 완료를 의미하지 않습니다. 통신 오류 후 자동 재시도는 하지 않습니다. 이미 접수한 동일 화면의 중복 전송은 브라우저가 막지만, 서버의 영속 중복 방지 저장소는 없습니다.
- Firebase 서명 인증서로 ID 토큰의 서명·issuer·audience·만료·이메일을 검증합니다. 관리 권한을 회수하려면 ADMIN_SEND_ENABLED를 false로 바꾸거나 OWNER 허용 계정을 변경합니다. ID 토큰 철회 상태를 별도로 조회하지 않으므로 발급된 토큰은 만료 전까지 유효할 수 있습니다.
