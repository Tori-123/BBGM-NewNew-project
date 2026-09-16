# BBGM Scoop UI 提案

依据：`docs/PRD.md`、`docs/schema.md`，以及你提供的 BBGM Scoop 页面稿（报头、头条、LATEST / FEATURES、CAMPUS LIFE、边栏）。

**约束：** 不另起皮肤。主页按截图还原（报头、导航、头条网格、LATEST、FEATURES、CAMPUS LIFE、右侧栏）。三案共用同一套视觉代币；区分的是内页（登录 / 发帖 / 栏目 / 我的帖子）怎么铺进这张报纸，而不是换成仪表盘或社交 App。

**推荐选提案 1。** 2 / 3 只在「发帖入口有多显眼、栏目页有多密」上让步，便于如果主页截图与主故事（登录发帖）抢注意力时改一版。

---

## 共用视觉代币（三案都必须遵守）

从页面稿抽出，实现时当作规范，不要「大约像报纸」。

| 代币 | 取值 |
| --- | --- |
| 页底 | `#FFFFFF`，正文近黑 `#111111` |
| 品牌蓝 | `#1A4FBF`：`BBGM` 斜体字标、栏目 kicker、边栏小标题、链接 |
| 图片占位 | `#D6DEEE` 矩形，无圆角、无阴影、无渐变 |
| 分割 | 1px / 2px 纯黑横线；栏目名旁一条加长黑线（如 `LATEST ———`） |
| 报头字 | `BBGM` 蓝色斜体衬线；竖线分隔；`SCOOP` 黑色超粗衬线 |
| 标题字 | 高对比衬线（建议 **Playfair Display** 或 **Source Serif 4**） |
| 导航 / UI |  Grotesque 无衬线（建议 **Inter** 或系统 ui-sans），导航全大写、字距略开 |
| kicker | 约 11px、全大写、蓝色、跟踪（NEWS / DORM LIFE / FEATURED / SPORTS） |
| 密度 | 印刷校报：大空白、模块对齐、卡片不悬浮 |
| 动效 | 无 3D、无视差；链接与按钮仅颜色变化 |

**截图有、PRD 标为 Should/Could 的块：** 视觉仍按主页稿摆出来，避免主页「缺一块就不像」。第一版数据绑定优先 Must。

| 主页块 | 第一版数据 |
| --- | --- |
| 头条 FEATURED、右侧副条、LATEST、FEATURES、CAMPUS LIFE | `GET /posts` 按时间填入；无图时用 `#D6DEEE` 占位 |
| 导航 NEWS / SPORTS / DORM LIFE / EVENTS | 进栏目列表（Must） |
| 导航 OPINION / PHOTO | 可进空栏目页（Could）；不要从报头删掉 |
| SUBMIT | 发帖主操作（Must）；未登录先去登录 |
| 顶栏搜索 | 保留外形（截图）；第一版不接检索接口，提交时用报头下一条静态说明「Search comes in a later version」 |
| PHOTO OF THE DAY、TRACK OF THE DAY、STUDENT ART | 保留栏位；无数据用空态，不接 Spotify 也可（Could） |
| UPCOMING | 绑 `is_activity=true` 的帖（Must 活动露出） |

---

### 提案 1：Scoop 印刷版（主页 = 截图）

- **视觉基调**：白底、黑线、蓝 kicker、衬线大标题、浅紫蓝图框。气质是独立学生报纸，不是论坛或后台。读者（P2）扫报头和头条就能信这是校园媒体；发帖者（P1/P3）走同一套报纸，而不是跳进另一套产品皮。
- **信息架构与布局**：
  - **全局壳（除登录注册外每页）：** 顶栏 `ABOUT` `CONTACT` + 今日日期 → 报头（搜索 / `BBGM | SCOOP` / Student Media）→ 标语 → 导航 `NEWS SPORTS DORM LIFE OPINION EVENTS PHOTO SUBMIT`。在顶栏右侧日期左侧加账号，不破坏截图报头：未登录 `SIGN IN`；已登录展示名 + `MY POSTS` + `SIGN OUT`。
  - **首页 `/`：** 严格按截图。主栏：FEATURED 大图+大标题 → LATEST（左大图 + 右三条）→ FEATURES（左窄列 + 右大图）→ CAMPUS LIFE 三列 → SPECIAL FEATURE 大图+文。右栏：Photo of the Day、Track of the Day、Upcoming、Student Art。FEATURED 取列表第一条；副条与 LATEST 取后续 `PostSummary`；活动帖在卡片上用 kicker 下的一行时间+地点（schema 已有 `starts_at` / `location`）。
  - **栏目 `/news` `/sports` `/dorm-life` `/events`：** 报头+导航保留，当前栏目在导航下划黑线。版面像报纸栏目页：左大标题「SPORTS」+ 黑线，下列 `PostSummary` 行（左占位图、蓝 kicker、衬线标题、excerpt；活动行加时间地点）。右侧可继续用 Upcoming 窄栏。
  - **详情 `/posts/:id`：** 文章页。蓝 kicker → 衬线大标题 → 作者 `display_name` 与 `created_at` → 活动则时间地点单独一行 → 占位图 → `body` 长栏正文（约 65–72 字符宽）。不是卡片堆。
  - **发帖 `/submit`（导航 SUBMIT）：** 仍在报头下。版心像「投稿台」：左栏标题/正文（衬线标题输入、无衬线正文）；右栏栏目、是否活动、活动时间与地点。主按钮 `Publish` 放右栏底部，黑色填充、无圆角或极小圆角，像印刷按钮而不是 App pill。
  - **我的帖子 `/me/posts`：** FEATURES 那种紧凑行列表（小图 + 标题），每行进详情。
  - **登录/注册 `/sign-in` `/register`：** 保留顶栏与报头（证明还在 Scoop），版心一条黑线下列窄表：邮箱、密码、展示名（仅注册）、`Sign in` / `Create account`。不要全屏插画、不要居中大卡片悬浮。
- **关键状态怎么呈现**：
  - **空列表：** 栏目名 + 黑线仍在；图框位置留 `#D6DEEE`；其下衬线一句 “No stories in Dorm Life yet.” + 已登录则文字链 “Be the first to publish”。边栏无活动：Upcoming 标题在，文案 “No upcoming events posted.”
  - **加载：** 不闪骨架 App；图框保持浅紫蓝，标题位置一条 2px 浅灰横线即可。整页不要转菊花挡住报头。
  - **错误：** 登录 `invalid_credentials` 出现在表单上沿、一条红字（不是 toast 盖住报头）。发帖 `validation_error` 写在对应字段下（标题、栏目、地点），`Publish` 旁不出现成功态；`storage_unavailable` 在表单顶一条：“Could not save the post. Try again in a moment.” 详情 `404`：报头仍在，正文区大标题 “Story not found.” 未登录点 SUBMIT：去 `/sign-in`，回来可继续发。
- **实现提示：** HTML + CSS（Grid / Flex）即可。字体用 Google Fonts：**Playfair Display** + **Inter**。不需要 3D、不需要动画库。Track of the Day 若要真 Spotify iframe 是唯一额外嵌入；第一版可用静态空态代替。搜索框纯 CSS，不必上检索库。
- **匹配度：** 读者按报纸扫栏目；学生从 SUBMIT 发帖并在首页/栏目被看见；活动时间地点印在列表行上——主故事与截图同一张报。

---

### 提案 2：Scoop 栏目版（主页仍 = 截图，内页更密）

- **视觉基调：** 与提案 1 同一报头、同一蓝黑白、同一图框。内页把「栏目列表」做成更密的新闻栏（行高更紧、图更小），方便 P2 一次扫完 Sports / Dorm / Events。气质仍是报纸内页，不是表格后台。
- **信息架构与布局：**
  - **首页：** 与截图、提案 1 相同，不改模块顺序。
  - **栏目页成为第二主场：** 通栏「SPORTS」超大衬线 + 黑线；第一条用较大图（半页宽），其余为无大图的横排：kicker / 标题 / excerpt / 活动时间地点同一行。分页放栏底 `Older stories` 文字链（对 schema `page`）。
  - **详情：** 同提案 1 文章栏，但活动帖在标题下用一条黑底白字「时间 · 地点」报头条（仍平面，不是徽章）。
  - **发帖：** 放在栏目页逻辑附近——`SUBMIT` 进入后先选栏目（四个大标签像印刷 section），再出标题正文；活动开关出现在选 Sports / Dorm Life / Events 之后。主按钮仍在表单底部，不进右栏。
  - **我的帖子：** 与栏目横排同一组件，只是数据来自 `GET /me/posts`。
  - **登录：** 同提案 1 的报头+窄表。
- **关键状态怎么呈现：**
  - 空栏目：超大栏目名留下，下面一句 “Nothing filed in Events.” 比提案 1 更「编辑部空栏」。
  - 加载：第一条大图框先出现浅紫蓝，下列三条线。
  - 错误：字段下红字；列表 `503` 在栏目名下：「Stories could not be loaded.」保留报头，不整页崩溃。
- **实现提示：** 仍是 CSS Grid。比提案 1 多一个「栏目横排」可复用组件。无新库。
- **匹配度：** 同一张报，更利 P2 按栏目把宿舍/体育/大型活动扫完；发帖多一步选栏目，主故事略长，适合栏目很多时。

---

### 提案 3：Scoop 投稿版（主页仍 = 截图，发帖路径更显）

- **视觉基调：** 仍是截图那张报。只把顶栏账号与 `SUBMIT` 加重：`SUBMIT` 用蓝色小 caps（与 kicker 同色），已登录展示名放在 Student Media 那一列下方。不改首页模块，不改字体体系。
- **信息架构与布局：**
  - **首页：** 截图原样。
  - **发帖是内页主角：** `/submit` 用「Letter to the editor」双栏——左：标题+正文占 2/3；右：栏目、活动、时间、地点、`Publish`。未登录访问时，同一版心直接嵌登录表（邮箱密码），成功后表单还在，不必先跳到孤立 `/sign-in` 再找回来。注册链放表单下。
  - **登录页仍存在**（书签、401 跳转），版式与投稿页同一窄栏，避免第三套皮。
  - **栏目 / 详情 / 我的帖子：** 同提案 1（文章报、紧凑 FEATURES 行）。
- **关键状态怎么呈现：**
  - 未登录发帖：投稿页上半是登录错误/表单，不是被踢走后丢上下文。
  - 校验失败：右栏活动字段下直接出 `location is required when this post is an activity`（与 schema 字段名对应的人话）。
  - 发布成功：跳转详情（201 的 `PostDetail`），不在首页做 toast。
  - 空「我的帖子」：FEATURES 行位空着，一句 “You have not published yet.” + `SUBMIT`。
- **实现提示：** CSS only。登录嵌在投稿页是路由状态（`?next=/submit` 或同页两段），不需要模态库、不需要抽屉库。
- **匹配度：** 对 P1/P3 主故事最短（看见 SUBMIT → 登录或直接写 → 发布）；首页对 P2 仍是那张校报。若担心 `SUBMIT` 变蓝会「不像截图导航全黑」，则不要选本案，用提案 1。

---

## 页面与 PRD 对照（选定后都要有路由，禁止单页堆所有状态）

| 路由 | PRD | 三案共同点 |
| --- | --- | --- |
| `/` | M7 首页露出 | 截图主页 |
| `/news` `/sports` `/dorm-life` `/events` | M3/M6 | 栏目列表 |
| `/posts/:id` | M6 详情 | 文章栏 |
| `/submit` | M4/M5 发帖 | 报纸投稿表 |
| `/me/posts` | P1-US2 | 自己的列表 |
| `/sign-in` `/register` | M1 | 报头下的窄表 |
| 顶栏退出 | M1 | 链，不是设置里的深层菜单 |

第一版不做原生 App 导航、不做底部 Tab、不做暗色主题。
