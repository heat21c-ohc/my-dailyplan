# Daily Plan 작업 목록 및 기록 지침

## 기록 규칙

- 새 작업은 `Backlog`에 추가한다.
- 작업을 시작하면 `In Progress`로 옮기고 담당자와 시작 시간을 적는다.
- 작업이 끝나면 `Done`으로 옮기고 변경 파일, 검증 결과, 남은 리스크를 적는다.
- 발견한 버그나 개선 제안은 `Issue / Suggestion`에 남긴다.

## 작업 기록 양식

```text
- ID:
  담당:
  상태:
  범위:
  변경 파일:
  검증:
  리스크/메모:
```

## Checkpoints

- 날짜: 2026-05-21
  이름: `checkpoint-2026-05-21-daily-plan-layout`
  기준 커밋: `1b13c09 chore: checkpoint daily plan layout`
  목적: Daily Plan 레이아웃, 기본 기능, 협업 문서, 작업 로그를 포함한 복귀 기준점
  복귀 참고: `git checkout checkpoint-2026-05-21-daily-plan-layout`

## Backlog

- ID: DP-008
  담당: 미배정
  상태: Backlog
  범위: 날짜별 계획 히스토리 저장 기능 검토
  변경 파일: 미정
  검증: 날짜 변경 후 과거 데이터 조회 가능 여부
  리스크/메모: 현재는 단일 로컬 저장 상태만 유지

- ID: DP-009
  담당: 미배정
  상태: Backlog
  범위: PDF 또는 인쇄 최적화 스타일 추가 검토
  변경 파일: `styles.css`
  검증: A4 출력 시 주요 섹션 잘림 여부
  리스크/메모: 브라우저별 인쇄 결과 차이 확인 필요

## In Progress

- ID: DP-027
  담당: 공명
  상태: In Progress
  범위: 백로그 기능(DP-008, DP-009) 분석 및 기술적 개선안 제안
  예상 변경 파일: TASK_LOG.md, PROJECT_PLAN.md
  시작 시간: 2026-05-21 17:20
  확인한 문서: TEAM_HANDOFF_GUIDE.md, PROJECT_PLAN.md, AGENT_RR.md, TASK_LOG.md, DESIGN.md
  리스크/질문: 주군의 직접적인 코드 변경 명령이 있기 전까지 소스 코드는 안전하게 유지하며 기술 설계와 분석을 최우선으로 진행함.

## Done

- ID: DP-026
  담당: 멀린
  상태: Done
  범위: Important 편집 툴바 제거
  변경 파일: `index.html`, `TASK_LOG.md`
  검증: Important 영역의 B/I/U/목록 툴바 제거, 다른 에디터 툴바 유지 확인 예정
  리스크/메모: Important 입력 영역은 contenteditable과 저장 기능 유지

- ID: DP-025
  담당: 멀린
  상태: Done
  범위: TO DO LIST와 TIME LINE 기본 행 수 변경
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: 기본 생성 행 수를 각각 6개로 변경하고 JS 문법 검증 예정
  리스크/메모: 이미 localStorage에 저장된 기존 행은 유지되므로 초기화 전에는 기존 개수가 보일 수 있음

- ID: DP-024
  담당: 멀린
  상태: Done
  범위: PC 화면 밀도 개선을 위한 폰트/행 높이 축소
  변경 파일: `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 입력 폰트 12px, 행 높이 축소, PC 넓은 화면 2열/중간 화면 1열 전환 확인
  리스크/메모: PC 한눈보기와 좁은 화면 겹침 방지 사이 균형을 위해 1500px 이하 1열 유지

- ID: DP-023
  담당: 멀린
  상태: Done
  범위: TO DO/TIME LINE 겹침과 삭제 버튼 중복감 제거
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: work-grid 기본 1열 전환, 날짜 입력 폭 유동화, 행 삭제 버튼을 제목 줄 우측으로 분리 확인
  리스크/메모: TO DO/TIME LINE은 항상 세로 배치되어 가독성을 우선함

- ID: DP-022
  담당: 멀린
  상태: Done
  범위: 좁은 왼쪽 컬럼에서 TO DO/TIME LINE 겹침 방지
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: 1500px 이하에서 TO DO/TIME LINE을 1열로 전환해 입력칸과 버튼 겹침 방지
  리스크/메모: 세로 길이는 늘어나지만 입력 가독성과 조작 안정성을 우선함

- ID: DP-021
  담당: 멀린
  상태: Done
  범위: 왼쪽 주요 작업 영역 가로 폭 축소
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: main-grid 좌측 최소 폭과 비율 축소, 우측 영역 비율 확대 확인
  리스크/메모: 너무 줄이면 TO DO/TIME LINE 입력 폭이 다시 부족해질 수 있어 소폭만 조정

- ID: DP-020
  담당: 멀린
  상태: Done
  범위: THANKS GOD/SUMMARY 위치 변경
  변경 파일: `index.html`, `styles.css`, `TASK_LOG.md`
  검증: THANKS GOD/SUMMARY를 오른쪽 컬럼 MEMO 아래로 이동하고 임의 파란 테두리 제거 확인
  리스크/메모: 오른쪽 컬럼 폭이 좁아지는 화면에서는 THANKS GOD/SUMMARY가 1열로 전환됨

- ID: DP-019
  담당: 멀린
  상태: Done
  범위: 하단 리뷰 영역 파란 테두리 적용 및 작업 영역 폭 조정
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: THANKS GOD/SUMMARY 리뷰 영역 파란 테두리, 패널 상단 파란 라인, TO DO/TIME LINE 영역 비율 축소 확인
  리스크/메모: 오른쪽 영역 확대로 Calendar/MEMO 가독성 개선 기대

- ID: DP-018
  담당: 멀린
  상태: Done
  범위: 사용자 요청 기준 화면 배치 재구성
  변경 파일: `index.html`, `styles.css`, `TASK_LOG.md`
  검증: 왼쪽 Important 상단/TO DO+TIME LINE 하단, 오른쪽 Calendar+MEMO, 하단 THANKS GOD+SUMMARY 구조 확인
  리스크/메모: 중간 화면에서는 TO DO/TIME LINE이 세로로 전환되어 입력 폭을 우선 확보

- ID: DP-017
  담당: 멀린
  상태: Done
  범위: 전체 화면 구성 재정리
  변경 파일: `index.html`, `styles.css`, `TASK_LOG.md`
  검증: Important 최상단 배치, TO DO/TIME LINE/Calendar 작업 영역 분리, 하단 노트 영역 재배치 확인
  리스크/메모: Google Calendar는 연동 보류 상태이며 현재는 자리 표시 패널만 제공

- ID: DP-016
  담당: 멀린
  상태: Done
  범위: 긴 업무/일정 입력 내용 확인성 개선
  변경 파일: `index.html`, `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 업무/일정 입력을 자동 높이 textarea로 변경하고 긴 문자열 줄바꿈 처리 확인
  리스크/메모: 매우 긴 내용은 최대 높이 이후 내부 스크롤 대신 별도 상세 편집 모달 검토 가능

- ID: DP-015
  담당: 멀린
  상태: Done
  범위: 입력 폰트와 중간 화면 레이아웃 개선
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: 입력 폰트 축소, 행 높이 조정, 1100px 이하 1열 전환 확인
  리스크/메모: 브라우저별 날짜/시간 native UI 폭 차이는 실제 화면에서 추가 점검 필요

- ID: DP-014
  담당: 멀린
  상태: Done
  범위: 날짜/시간 입력 잘림 개선
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: 시작/완료 입력을 세로 배치로 변경하고 최소 입력 폭 확보
  리스크/메모: 브라우저별 날짜 입력 표시 방식 차이는 추가 QA 필요

- ID: DP-013
  담당: 멀린
  상태: Done
  범위: 드래그 이동 위치 표시 방식 변경
  변경 파일: `app.js`, `styles.css`, `TASK_LOG.md`
  검증: 자리 표시 박스 제거, 대상 행 위/아래 삽입선 표시 로직 확인
  리스크/메모: 삽입 위치는 마우스가 대상 행의 상단 절반이면 위, 하단 절반이면 아래로 결정됨

- ID: DP-012
  담당: 멀린
  상태: Done
  범위: TO DO LIST와 TIME LINE 드래그 이동 시각 피드백 개선
  변경 파일: `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 드래그 중 행 강조, 주변 행 흐림, 삽입 위치 표시자 생성 로직 확인
  리스크/메모: 실제 터치 기기에서 드래그 감도 추가 확인 권장

- ID: DP-011
  담당: 멀린
  상태: Done
  범위: 팀 작업 지시서 문서 추가
  변경 파일: `TEAM_HANDOFF_GUIDE.md`, `TASK_LOG.md`
  검증: 작업 전 확인 문서, 팀별 지시, 기록 양식 포함 확인
  리스크/메모: 실제 팀 투입 시 담당자명과 작업 ID만 갱신하면 됨

- ID: DP-010
  담당: 멀린
  상태: Done
  범위: 사용성 중심 UI 재구성
  변경 파일: `index.html`, `styles.css`
  검증: 섹션 헤더, 입력 라벨, 행 카드 구조, 모바일 1열 구조 확인
  리스크/메모: 실제 브라우저 시각 QA 후 간격과 높이 추가 조정 가능

- ID: DP-001
  담당: 멀린
  상태: Done
  범위: 프로젝트 요구사항과 성공 기준 정리
  변경 파일: `PROJECT_PLAN.md`
  검증: 요청 기능과 문서 성공 기준 대조
  리스크/메모: 날짜별 히스토리는 별도 후속 범위로 분리

- ID: DP-002
  담당: 멀린
  상태: Done
  범위: 에이전트별 R&R과 협업 규칙 작성
  변경 파일: `AGENT_RR.md`
  검증: 역할, 산출물, 완료 기준 포함 확인
  리스크/메모: 실제 팀 운영 시 담당자 이름만 갱신하면 됨

- ID: DP-003
  담당: 멀린
  상태: Done
  범위: 작업 목록과 기록 지침 작성
  변경 파일: `TASK_LOG.md`
  검증: Backlog, In Progress, Done, 이슈 기록 구조 확인
  리스크/메모: 모든 에이전트가 작업 전후로 갱신해야 함

- ID: DP-004
  담당: 멀린
  상태: Done
  범위: Daily Plan HTML 구조 작성
  변경 파일: `index.html`
  검증: TO DO LIST, TIME LINE, Important, MEMO, THANKS GOD, SUMMARY 영역 확인
  리스크/메모: 정적 웹페이지 방식으로 구현

- ID: DP-005
  담당: 멀린
  상태: Done
  범위: DESIGN.md 기반 반응형 스타일 작성
  변경 파일: `styles.css`
  검증: PC 3열, 태블릿 2열, 모바일 1열 전환 규칙 확인
  리스크/메모: 실제 기기별 터치 드래그는 추가 실기기 QA 권장

- ID: DP-006
  담당: 멀린
  상태: Done
  범위: 목록 추가, 삭제, 드래그 정렬, 날짜/시간 자동 입력 구현
  변경 파일: `app.js`
  검증: 행 조작 이벤트, 로컬 저장 흐름, ID 생성 fallback 확인
  리스크/메모: 브라우저의 `datetime-local` UI는 OS/브라우저별로 다를 수 있음

- ID: DP-007
  담당: 멀린
  상태: Done
  범위: 기본 에디터와 자동 저장 구현
  변경 파일: `index.html`, `app.js`
  검증: 편집 영역별 저장 키와 툴바 명령 연결 확인
  리스크/메모: 고급 에디터가 필요하면 별도 라이브러리 도입 검토

## Issue / Suggestion

- 날짜별 데이터 분리가 필요하면 저장 구조를 `planDate` 기준 맵으로 변경하는 것이 좋다.
- 협업자가 많아질 경우 Git 브랜치 전략과 PR 템플릿을 추가하는 것이 좋다.
