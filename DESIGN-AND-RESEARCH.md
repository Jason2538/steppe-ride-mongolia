# STEPPE 조사·기획·기술 구성·로드맵

## 1. 조사 결과와 차별점

공식 개발 자료·개발자 설명·일부 이용자 후기를 구분해 조사했습니다. 직접 플레이한 비교나 AAA 게임 전체 소스 분석은 아닙니다. 아래 자료는 설계 참고용이며 코드·모델·음원을 가져오지 않았습니다.

| 사례 | 확인한 제작 방식 | 이용자 의견 사례 | 적용할 점 / 피할 점 |
|---|---|---|---|
| Slow Roads | Three.js, 절차 지형, 도로 주변 LOD, 자체 경량 물리, 청크·메모리 재사용 | 편안한 풍경 주행에 호평. 도로 밖 충돌·다양한 환경 요청 | 청크와 가벼운 물리 적용. 도로 밖 처리가 모호해지는 문제를 복구 기능으로 보완 |
| Traffic Rider | 끝없는 고속도로, 1인칭, 실제 엔진 녹음, 낮·밤. 내부 생성 알고리즘·물리 엔진은 확인하지 못함 | 단순하고 재미있다는 반응과 광고·임무 난도·반복 보상 불만 | 속도·엔진 감각 참고. 임무와 반복 보상은 관광 경험에 넣지 않음 |
| RIDE 5 | Unreal Engine, Pacejka 계열 접지, 서스펜션·엔진 브레이크·라이더 상호작용, 날씨·구름 | 물리 개선 평가와 제동·선회·입력 설정에 대한 상반된 평가 | 물리 원리만 단순화해 적용. 최초부터 정밀 타이어·라이더 해석을 목표로 잡지 않음 |
| ETS2 | 현실 도로망을 선별·축약한 지도, 토크와 엔진 저항을 고려한 주행 | 장거리 주행의 편안함, 일부 상호작용 깊이·외로움 의견 | 순항감과 드문 생활 흔적. 같은 풍경만 반복되지 않도록 확장 |
| Forza Horizon 5 | 현장 참고 자료를 사용한 11개 환경 구역, 사진 모드 | 환경·하늘·주행을 좋아한다는 후기 사례. 이번 조사로 체계적인 불만 분포는 확인하지 못함 | 구역별 색·식생과 사진 모드. 웹에 AAA 그래픽 비용을 그대로 옮기지 않음 |
| Babylon/Havok 차량 데모 | 강체 차체 + 바퀴용 구체 형상 검사로 제작자가 아케이드 물리를 직접 구성 | 조작·음향 호평. 바퀴 떨림·가속 회복 의견, 제작자는 트랙 경계 문제 설명 | 엔진 선택만으로 차량 물리가 완성되지 않는 점을 반영 |

주요 기술 자료:

- Slow Roads 개발자: https://web.dev/case-studies/slow-roads
- Slow Roads 2.0 개발자·사용자 대화: https://www.reddit.com/r/threejs/comments/1iekc71/slow_roads_20_endless_procedurallygenerated/
- Traffic Rider 개발사 소개·사용자 후기: https://play.google.com/store/apps/details?hl=en_CA&id=com.skgames.trafficrider
- RIDE 5 물리: https://ride5.ridevideogame.com/ride-5-and-the-importance-of-physics-in-turning-numbers-into-emotions/
- RIDE 5 환경: https://ride5.ridevideogame.com/
- RIDE 이용자 의견 사례: https://www.reddit.com/r/ride5/comments/1iazitd
- ETS2 지도 설계: https://blog.scssoft.com/2012/04/map-is-never-big-enough.html
- SCS 물리 개선: https://blog.scssoft.com/2026/01/158-update-physics-collisions-changes.html?m=1
- ETS2 이용자 후기: https://www.grouvee.com/games/111394-euro-truck-simulator-2/
- Forza 환경: https://news.xbox.com/en-us/2021/07/26/exploring-the-biomes-and-seasons-of-forza-horizon-5/
- Forza 사진: https://forza.net/news/forza-horizon-5-explore-the-horizon
- Forza 이용자 의견: https://www.reddit.com/r/ForzaHorizon/comments/14yg0mk/i_see_horizon_5_get_a_lot_of_criticism_which_is/
- Babylon 데모 제작·피드백: https://forum.babylonjs.com/t/babylon-toolkit-havok-vehicle-physics-system/62636

차별점은 몽골 초원의 공간감, 오토바이의 노면 반응, 사용자가 고르는 순항 속도를 결합하는 것입니다. 화면이 아니라 길과 풍경에 집중하도록 HUD를 가장자리에 배치합니다.

## 2. 게임 기획

확정 조건: 준실사 지향, HTML/JavaScript 기초 사용자, PC와 모바일 기본 지원, 추가 예산 없이 제작, 가상의 무한 초원 도로, 공개 웹 배포.

핵심 흐름은 시작 화면 → 모드 선택 → 출발 → 자유 주행 → 설정/일시정지 → 재개입니다. 완주·순위·실패 화면 없이 원하는 만큼 달릴 수 있습니다. 도로 밖에서 불안정해지면 짧게 회복합니다.

포장 차도는 왕복 2차로 약 7m, 오른쪽 차로에서 출발합니다. 차로당 3.5m는 JICA 몽골 동부 간선도로의 2005년 설계 사례를 참고했습니다. 전국 공통 최신 규격이라는 의미는 아닙니다. 길어깨는 약 2.2m로, 게임에서 도로와 초지를 잇기 위한 구성입니다.

- 우측통행 법령: https://legalinfo.mn/en/edtl/16758728204231
- JICA 설계 p.2-14: https://openjicareport.jica.go.jp/pdf/11785508_01.pdf#page=41
- 표지 종류 참고: https://www.traffic-institute.mn/c_rule/c-01/c-01-03/eng/c-01-03e-h1-1.html
- 개정 규칙 경찰 안내: https://police.gov.mn/p/3888

MVP에는 도로 표지판을 배치하지 않았습니다. 최신 도면의 모양·색·치수를 확인한 뒤 확장합니다. 게르와 양도 문화·축산의 정밀 재현이 아닌 소규모 배경 모델입니다.

관광 100km/h / 스피드 180km/h. 크루즈 40·60·80·100km/h. 차로 유지 보조는 별도 설정이며 직접 조향 시 수동 조작이 우선합니다. 손을 놓았을 때 곡선을 따라 오른쪽 차로에 정렬해 풍경 감상을 돕습니다. 계기판은 속도·RPM·자동 기어·거리·노면·린을 표시합니다. 키보드·마우스·화면 버튼과 기본 게임패드 경로를 제공합니다.

## 3. 기술과 구조

Three.js r180 + WebGL2 + 표준 JavaScript ES 모듈 + HTML/CSS + Web Audio. 초기 제안의 TypeScript/Vite는 필수 조건이 아니므로, 다운로드 후 설치/빌드 없이 수정할 수 있는 구조를 선택했습니다. 게임 서버와 DB가 필요 없는 정적 사이트입니다.

| 모듈 | 역할 |
|---|---|
| simulation.js | 단위 m·s, 60Hz 고정 계산. 가속·저항·경사·제동·자동 기어·RPM·접지·기울임·복구 |
| world.js | 240m 청크. 전방 6/9/12개와 후방 2개 범위 유지. 거리별 지형 정밀도·인스턴싱·안개 |
| bike.js | 기본 도형으로 만든 오토바이·라이더·바퀴·핸들 |
| game.js | 입력 통합·누적 시간 계산·카메라·UI·설정·포커스 이탈 처리 |
| audio.js | 발진기 엔진음과 필터링한 바람 노이즈. 각 볼륨 독립 조절 |

Three.js 인스턴싱 근거: https://threejs.org/docs/pages/InstancedMesh.html

렌더러는 WebGL2를 요구합니다: https://threejs.org/docs/pages/WebGLRenderer.html

Rapier 대안: https://rapier.rs/docs/user_guides/javascript/vehicle_controller/ — 차체 강체와 레이캐스트 바퀴 컨트롤러를 제공하지만 오토바이의 균형·린 모델은 별도로 만들어야 합니다. 초기에는 라이브러리 자체보다 주행 감각을 먼저 검증하기 위해 자체 경량 계산을 사용했습니다. 충돌과 서스펜션 요구가 늘면 Rapier/Cannon-es/Babylon-Havok을 다시 비교합니다. 이번 구현에 이 물리 라이브러리들을 포함하지 않았습니다.

최적화: 지형 정밀도는 길 주변에 집중, 동일 풀·돌은 인스턴싱, 청크 밖 geometry와 임시 material 해제, 공유 geometry/material 재사용, 2km마다 원점 재배치, 카메라 원점도 동기화, 매 프레임 HUD 갱신 대신 10Hz, 물리 60Hz와 렌더링 분리, 화면 해상도 상한. 품질별 pixel ratio 상한은 1/1.4/1.8입니다. 모바일 첫 실행은 낮음이며 설정을 저장하면 해당 값을 사용합니다.

## 4. MVP 범위

구현: 초원 길 하나·오토바이 한 대·낮·직접 속도 조절·HUD에 더해 기본 크루즈, 두 속도 모드, 4개 고정 카메라, PC·모바일 입력, 품질·소리 설정, 차로 보조, 도로 복귀를 제공합니다.

미구현: 실측 DEM, 사막·호수·강, 비포장 도로 구역, 날씨·시간 변화, 자유 시점·사진 저장, 배경음악, 수동 기어, 앞뒤 브레이크 분리, 정교한 서스펜션, 다양한 가축·오토바이. 카메라의 '넓게 보기'는 자유 시점이 아닙니다. 초지의 저항·접지 차이는 구현했지만 별도의 자갈길을 구현했다고 주장하지 않습니다.

## 5. 실행·배포

README.md 참조. `npm start`는 개발용 정적 서버만 실행합니다. `npm run check`는 문법과 주행 계산 검증입니다. `dist/`를 그대로 정적 호스팅에 게시할 수 있습니다. 배포본에는 Three.js 파일까지 포함되어 별도 CDN 요청이 없습니다.

## 6. 확장 로드맵

| 단계 | 내용 | 확인할 기준 |
|---|---|---|
| 1 | 자갈·흙길, 앞뒤 브레이크 분리, 접지 곡선, 수동/자동 기어 | 같은 속도에서 노면별 제동거리·슬립이 달라지고, 복구가 부드러운가 |
| 2 | 사막·호수·강과 자연스러운 전이, 말·소·낙타, 오보·표지 | 선택한 지역·계절의 근거 자료에 맞는가, 반복 풍경이 줄었는가 |
| 3 | 아침·낮·노을·밤, 태양·그림자, 맑음·흐림·바람·비 | 품질 낮음에서도 야간 시인성과 30fps 목표를 유지하는가 |
| 4 | 자유 카메라·사진 모드·PNG 저장·HUD 숨김 | 일시정지 상태 촬영, 터치 조작, 브라우저 다운로드 정책에 맞는가 |
| 5 | 다른 오토바이·엔진음, 선택적 음악 | 차종별 질량·토크·기어 특성이 구분되는가, 개별 음원 권리가 확인됐는가 |
| 6 | 실제 휴대폰·Safari 최적화, 게임패드 매핑, 진행 저장 | 발열·긴 주행·화면 전환·포커스 이탈에서 안정적인가 |

## 실측 지형과 자료 후보

SRTM 약 30m 자료는 EarthExplorer에서 지역을 선택해 받을 수 있습니다. Copernicus GLO-30은 세계 범위 약 30m 표면 높이와 별도 무료 라이선스를 제공합니다. 선택 지역을 자르고, 좌표 변환·다운샘플·청크 압축·도로 평탄화를 한 뒤 정적 파일로 포함하는 방법을 검토했습니다. 이 해상도로 도로 균열·자갈·작은 요철을 얻을 수는 없으므로 별도 제작해야 합니다. 실제 지형을 무한히 연결하는 부분은 창작 연결 구간으로 표시해야 합니다.

- USGS: https://www.usgs.gov/faqs/where-can-i-get-global-elevation-data
- Copernicus 데이터·출처 표기: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- 2026년 Copernicus 뷰 서비스 접근 변경: https://dataspace.copernicus.eu/news/2026-7-17-copernicus-dem-30m-view-service-license-acceptance

| 자료 후보 | 용도 | 조건 | 이번 버전 사용 여부 |
|---|---|---|---|
| Poly Haven | 재질·하늘·모델 | CC0, 상업 이용, 크레딧 의무 없음. 에셋과 API 이용 조건은 구분 | 미사용 |
| ambientCG | 아스팔트·초지·모래 | CC0, 게임에 원본 포함 가능 | 미사용 |
| Quaternius | 동물·환경 모델 | 현재 QAL 페이지와 FAQ의 CC0 안내 차이. 다운로드할 팩·버전의 조건 확인 | 미사용 |
| Sketchfab | 개별 모델 | CC0 또는 CC BY만 우선 검토. CC BY 표기 의무, NC 제외 | 미사용 |
| Freesound | 엔진·바람·비 | 파일별 CC0/CC BY 확인, NC 제외 | 미사용 |
| Copernicus GLO-30 | 실제 높이 | 별도 무료 라이선스, 가공 여부에 맞는 공식 출처 문구 | 미사용 |

라이선스 근거: https://polyhaven.com/license · https://docs.ambientcg.com/license/ · https://quaternius.com/license.html · https://quaternius.com/faq.html · https://www.sketchfab.com/blogs/community/an-introduction-to-creative-commons-licenses/ · https://freesound.org/help/faq/

특정 몽골 음악 녹음의 상업 이용 가능 여부는 확인하지 않았으므로 곡을 추천하거나 사용하지 않았습니다. 실제 사용 자료 전체는 `dist/credits.html`의 표를 확인하세요.
