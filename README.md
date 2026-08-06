# Room Booker Pro

첨부한 ZIP을 참고해 드론관제실 회의실 예약 시스템을 실제 운영 가능한 웹서비스로 만들어줘.




  가장 중요한 조건:

  - `README_FOR_LOVABLE.md`를 최우선 요구사항으로 따라줘.

  - `reference/index.html`은 디자인과 화면 흐름의 기준이다. 현재 디자인, 색상, 레이아웃, 문구, 버튼, 애니메이션을 임의로

  바꾸거나 새로 디자인하지 마.

  - 안내 모달의 4단계 스크린샷도 동일하게 유지해줘.

  - reference HTML 안의 시연용 예약 데이터·브라우저 메모리 방식·비밀번호 처리 방식은 그대로 사용하지 말고, 화면 참고용으

  로만 봐줘.




  실제 기능은 Lovable에 연결한 Supabase 클라우드로 새로 구현해줘.

  - 처음에는 예약이 비어 있는 상태로 시작

  - 부서가 달라도 동일한 예약 현황을 함께 보고, 새로고침 후에도 유지

  - 예약 등록, 시간 변경, 예약 전체 취소 구현

  - 동일 회의실·날짜·시간대 중복 예약은 서버에서 막기

  - 예약자 비밀번호와 관리자 인증은 브라우저 코드에 노출하지 말고 서버 측에서 안전하게 처리

  - 일반 화면에는 다른 예약자의 이름이나 예약 비밀번호를 보여주지 말 것

  - 관리자 화면에서만 권한 확인 후 예약 관리 가능하게 할 것




  구현 후에는 서로 다른 브라우저에서 예약 공유, 새로고침 유지, 동시 중복예약 차단, 안내 모달 이미지 4장 표시까지 직접 테

  스트해줘.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sndronecenterapply.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6c0a59f1-36bd-4d72-a7ce-14e0ccaab21a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
