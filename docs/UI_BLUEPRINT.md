# UI 蓝图：Scoop 印刷版

选定 2.3A **提案 1**。主页按 BBGM Scoop 页面稿还原。字段只绑定 `docs/schema.md`；没有封面图、featured 标记、检索接口——图框是 CSS 占位，不是数据。

---

## 1. 信息架构

多页路由，报头+导航在所有页面保留（含登录/注册）。无底部 Tab。管理员用户列表是站点内一页，不是独立后台套件。

| 路由 | 页面 | 鉴权 | 数据 |
| --- | --- | --- | --- |
| `/` | 首页（截图版式） | 公开 | `GET /api/v1/posts?page=1&page_size=20` |
| `/news` | 栏目 News | 公开 | `GET /api/v1/posts?category=news` |
| `/sports` | 栏目 Sports | 公开 | `GET /api/v1/posts?category=sports` |
| `/dorm-life` | 栏目 Dorm Life | 公开 | `GET /api/v1/posts?category=dorm_life` |
| `/events` | 栏目 Events | 公开 | `GET /api/v1/posts?category=events` |
| `/community` | Community 卡片列表 | 公开 | `GET /api/v1/posts?category=community`；绑 `author.avatar` `title` `author.display_name` `images[0]` `reply_preview` `reply_count` |
| `/opinion` | 栏目占位（截图导航） | 公开 | **不请求** `category=opinion`（枚举外会 422）。固定空态。 |
| `/photo` | 栏目占位 | 公开 | 同上，不请求非法 category。 |
| `/posts/:postId` | 帖子详情 | 公开 | `GET /api/v1/posts/{post_id}`；Community 另 `GET .../comments` |
| `/submit` | 旧路径 | — | 重定向到 `/community` |
| `/me/posts` | 我的帖子 | 需登录 | `GET /api/v1/me/posts` |
| `/me/avatar` | 选/上传头像 | 需登录 | `PUT` / `POST /api/v1/me/avatar` |
| `/admin/users` | 用户与角色 | 需 `admin` | `GET /api/v1/admin/users`；`PATCH` 改 `role` |
| `/sign-in` | 登录 | 访客 | `POST /api/v1/auth/login` |
| `/register` | 注册 | 访客 | `POST /api/v1/auth/register` |
| `/about` `/contact` | 静态稿（截图顶栏） | 公开 | 无 API |

**全局壳 `PaperShell`**

- 顶栏左：`ABOUT` `CONTACT`（静态页）。顶栏右：账号区 + 本地日期文案 `Today: {formatted local date}`（不是 schema 字段）。
- 账号：启动时 `GET /api/v1/me`。`401` = 访客，显示 `SIGN IN`（去 `/sign-in`）。`200` = 已登录，显示头像（`avatar`）、`display_name`、`AVATAR`（`/me/avatar`）、`MY POSTS`（`/me/posts`）、`SIGN OUT`。`role===admin` 另显示 `USERS`（`/admin/users`）。
- 报头：左搜索框（外形保留；提交不调接口，在报头下出一条静态说明）。中：`BBGM | SCOOP` 链回 `/`。右：静态「BBGM STUDENT MEDIA / Independent Student Journalism」。
- 标语静态：`YOUR CAMPUS. YOUR STORIES. YOUR VOICE.`
- 导航：`NEWS` `SPORTS` `DORM LIFE` `COMMUNITY` `OPINION` `EVENTS` `PHOTO`。当前路由下划黑线。无 `SUBMIT`。发帖在对应栏目页内。
- 无页脚产品功能。

**栏目枚举 → 导航文案（展示层，不是新字段）**

`news` → NEWS；`dorm_life` → DORM LIFE；`sports` → SPORTS；`events` → EVENTS；`community` → COMMUNITY。

---

## 2. 设计规范

不用组件库。HTML + CSS（可用 Tailwind utility）。字体：Playfair Display（报头/标题）、Inter（导航/表单/正文 UI）。

| 角色 | Token / 值 |
| --- | --- |
| 页底 | `bg-white` `#FFFFFF` |
| 正文 | `text-neutral-900` `#111111` |
| 品牌蓝 / kicker / 链接 | `text-[#1A4FBF]` |
| 图框占位 | `bg-[#D6DEEE]` 直角矩形，无圆角无阴影 |
| 分割 | `border-black` 1px；栏目名旁 2px 黑线拉满 |
| 错误 | `text-red-700`，表单顶或字段下；不用 toast 盖报头 |
| 成功 | 发帖成功不在原页刷绿条，直接进详情 |
| 次要说明 | `text-neutral-500` 小字 |

**层级**

- 报头 `BBGM` 斜体衬线蓝 + `SCOOP` 超粗衬线黑
- FEATURED 主标题：衬线 48–64px
- 栏目名 `LATEST` / `FEATURES`：衬线约 28px + 黑线
- 卡片标题：衬线 20–28px
- kicker：Inter 11px 全大写蓝色 tracking
- excerpt / 表单：Inter 14–16px
- 日期/地点：Inter 12–13px `text-neutral-500`

**形态**

- 圆角：0 或最多 2px（`Publish` 按钮）
- 按钮：黑底白字，小 caps；链接按钮无填充
- 密度：印刷空白；卡片不悬浮、不 hover 抬起
- 输入：底边一条黑线或 1px 黑框，不要 iOS 大圆角
- 动效：无

**禁止绑定的幽灵字段：** `image_url`、`cover`、`featured`、`kicker`、`caption`、`photo_credit`、Spotify id。四栏图框与 Photo of the Day / Track of the Day / Student Art 为静态壳。Community 只绑 schema 的 `images[]`。

---

## 3. 状态

`GET /me` 的 `401` 是访客常态，**不是**错误条。

### 3.1 首页 `/`

| 状态 | 表现 |
| --- | --- |
| 加载 | 报头先出。图框已是 `#D6DEEE`；标题位一条 2px `bg-neutral-200` 横线。不挡报头转圈。 |
| 成功 | 将 `items` 按 `created_at` 已排序使用（服务端降序）。槽位按下表取 **互不重复的下标**；缺槽显示该槽空态，不循环填充。 |
| 空 | `total === 0`：FEATURED 图框仍在，其下 “No stories on campus yet.”；学生链到 `/community`，编辑提示到对应栏目发。右栏 Upcoming 标题在，“No upcoming events posted.” |
| 错误 | `503` / 其他：主栏顶 `ErrorBanner` ← `error.message`（如 Could not save… 类存储文案以响应为准）。不造假列表。 |

**首页槽位 ← `items[i]`（PostSummary）**

| 槽 | 下标 | 展示字段 |
| --- | --- | --- |
| FEATURED 大图+大标题 | `[0]` | `category`（kicker）、`title`、`excerpt`；`is_activity` 时 `starts_at` `location` |
| 右上两条 | `[1]` `[2]` | 同上 |
| 右下较宽一条 | `[3]` | 同上 |
| LATEST 左大 | `[4]` | 同上 |
| LATEST 右三条 | `[5]` `[6]` `[7]` | 同上 |
| FEATURES 左三紧凑 | `[8]` `[9]` `[10]` | `category` `title` `excerpt` |
| FEATURES 右大 | `[11]` | `category` `title` `excerpt` `created_at`；活动加 `starts_at` `location` |
| CAMPUS LIFE 三列 | `[12]` `[13]` `[14]` | `category` `title` `excerpt` `created_at` |
| SPECIAL FEATURE | `[15]` | `category` `title` `excerpt` `created_at` |
| UPCOMING 右栏 | 从 **同一** `items` 中筛 `is_activity === true`，最多 3 条 | `title` `starts_at` `location` |

点击任一故事 → `/posts/{id}`。

Photo of the Day / Track of the Day / Student Art：静态标题+空图框+固定说明（无 schema）。搜索提交：报头下静态 “Search comes in a later version.”

### 3.2 栏目页 `/news` 等

| 状态 | 表现 |
| --- | --- |
| 加载 | 栏目大标题+黑线先出；下列三行图框+横线。 |
| 成功 | `items[]` 逐行：`category` `title` `excerpt`；`is_activity` 时同行或下行 `starts_at` `location`。`total > page * page_size` 时底栏 `Older stories` 请求 `page+1`。 |
| Community | **不用 StoryRow**。每条卡片：`author.avatar`、`title`（链详情）、`author.display_name`、有则 `images[0]`、`reply_preview[0..3]` 的作者与正文；`reply_count`。点标题进详情。 |
| 发帖 | 有权限显示 `Write`，点开本页展开表单，`category` 锁当前栏目。Community 未登录显示去 `/sign-in?next=/community`。学生进四栏不显示按钮。`opinion`/`photo` 无发帖。 |
| 空 | `items.length === 0`：图框保留，“No stories in {栏目名} yet.” 不链独立发帖页。 |
| 错误 | 栏目名下 `ErrorBanner` ← `error.message`。`opinion`/`photo` 不发请求，直接空态句。 |

### 3.3 详情 `/posts/:postId`

| 状态 | 表现 |
| --- | --- |
| 加载 | 图框+标题横线。 |
| 成功 | kicker←`category`；标题←`title`；byline←`author.display_name`、`created_at`；活动行←`is_activity` 时 `starts_at` `location`；正文←`body`。 |
| Community | `category===community` 时正文下请求 `GET /comments`。楼主与每楼显示 `author.avatar`。有 `images[]` 则在正文下展示实图，不用四栏占位图框。楼层显示 `floor`、`author.display_name`、`body`、`replies[]`。已登录显示跟帖框；未登录显示去登录。`editor`/`admin` 另显示精选表。四栏详情**不**请求评论，图框仍是 CSS 占位。 |
| 空 / 404 | `error.code === not_found`：衬线 “Story not found.” 无假文。 |
| 错误 | `503`/`400`：`ErrorBanner` ← `error.message`。 |

### 3.4 栏目内发帖

无独立 `/submit` 页。旧路径重定向 `/community`。

| 状态 | 表现 |
| --- | --- |
| 入口 | 有权限：`Write` 展开本页表单。Community 未登录：「Sign in to post」→ `/sign-in?next=/community`。学生在四栏：无按钮。 |
| 学生 / Community | `title` `body` 与可选配图（最多 4 张）。提交 `category=community`、`is_activity=false`，再逐张 `POST .../images`。 |
| 编辑 / 管理员 | 四栏：`title` `body`；可标活动（`starts_at` `location`）。Community：同学生，含配图。栏目由页面锁定。 |
| 校验失败 422 | 表单顶不出现成功。`error.fields[]` 按 `field` 写到对应输入下。无 `fields` 时顶栏用 `error.message`。 |
| 401 | 清本地登录态，去 `/sign-in?next=` 当前栏目。 |
| 503 | 表单顶 `ErrorBanner` ← `error.message`。输入保留。 |
| 成功 201 | 收起表单，新帖出现在本栏目列表顶部。 |

### 3.5 我的帖子 `/me/posts`

| 状态 | 表现 |
| --- | --- |
| 401 | 去 `/sign-in?next=/me/posts`。 |
| 加载 | 与栏目行相同横线。 |
| 成功 | 行：`title` `excerpt` `category` `created_at`；活动加 `starts_at` `location`。点行 → `/posts/{id}`。 |
| 空 | `total === 0`：“You have not published yet.” 学生链 `/community`；编辑提示到对应栏目发。 |
| 503 | `ErrorBanner` ← `error.message`。 |

### 3.6 登录 `/sign-in` · 注册 `/register`

| 状态 | 表现 |
| --- | --- |
| 首次 | 窄表。登录：`email` `password`。注册加 `display_name`。 |
| 422 | 字段下 ← `error.fields[]`。 |
| 401 `invalid_credentials` | 表单上沿 ← `error.message`（Email or password is incorrect.）。 |
| 409 `email_taken` | `email` 下 ← `fields[].message` 或 `error.message`。 |
| 503 | 表单顶 ← `error.message`。 |
| 成功 | 写入本地用户（`id` `email` `display_name` `role` `created_at`）。有 `next` 则回该路径，否则 `/`。 |

### 3.7 用户列表 `/admin/users`

非 `admin`：不渲染表，去 `/`。`401` 去 `/sign-in?next=/admin/users`。

| 状态 | 表现 |
| --- | --- |
| 成功 | 行：`display_name` `email` `role`。`student` 显示授予编辑；`editor` 显示取消编辑；`admin` 只读。 |
| 错误 | `ErrorBanner` ← `error.message`。 |

不要用断网假数据充当错误处理。

---

## 4. 组件树

叶子标注 schema 字段。`ImageWell` 无数据绑定。

- `<PaperShell>`
  - `<UtilityBar>`
    - 链 About / Contact
    - `<AccountNav>`
      - 访客：SIGN IN
      - 登录：`display_name` ← `GET /me`；MY POSTS；`role===admin` 时 USERS；SIGN OUT
    - `<TodayLabel>` 本地日期（非 API）
  - `<Masthead>`
    - `<SearchStub>` 静态
    - 字标链 `/`
    - 静态 Student Media
  - `<Tagline>` 静态
  - `<SectionNav>` NEWS… COMMUNITY… SUBMIT
  - `<SearchNotice>` 仅搜索提交后显示（静态文案）
  - `<Outlet>` 下列页面之一

- `<Page: Home>`
  - `<ErrorBanner>` ← `error.code` `error.message`（仅列表失败）
  - `<HomeGrid>` ← `GET /posts` 的 `items` `total`
    - `<FeaturedLead>` ← `items[0]`
      - `<ImageWell>`
      - `<Kicker>` ← `category`
      - `<Headline>` ← `title` 链 `/posts/{id}`
      - `<Dek>` ← `excerpt`
      - `<ActivityLine>` 若 `is_activity` ← `starts_at` `location`
    - `<SecondaryPair>` ← `items[1]` `items[2]`（同 StoryTile 字段）
    - `<SecondaryWide>` ← `items[3]`
    - `<SectionRule>` 文案 LATEST
    - `<LatestLead>` ← `items[4]`（`category` `title` `excerpt` `id`）
    - `<LatestStack>` ← `items[5..7]`
    - `<SectionRule>` FEATURES
    - `<CompactColumn>` ← `items[8..10]`（`category` `title` `excerpt` `id`）
    - `<FeatureLead>` ← `items[11]`（+ `created_at`）
    - `<SectionRule>` CAMPUS LIFE
    - `<CampusTrio>` ← `items[12..14]`（`category` `title` `excerpt` `created_at` `id`）
    - `<SpecialFeature>` ← `items[15]`（`category` `title` `excerpt` `created_at` `id`）
  - `<Rail>`
    - `<StaticPhotoOfDay>`
    - `<StaticTrackOfDay>`
    - `<UpcomingRail>` ← `items` 中 `is_activity===true` 的 `id` `title` `starts_at` `location`
    - `<StaticStudentArt>`

- `<Page: Category>`
  - `<SectionRule>` 栏目名
  - `<WriteToggle>` 有权限时；Community 未登录为登录链
  - `<ComposeForm>` 展开后：`title` `body`；Community 另 `images`；四栏可活动字段。`category` 锁页面
  - `<ErrorBanner>` ← `error.message`
  - `<StoryRowList>` ← `items[]`
    - `<StoryRow>`
      - `<ImageWell>`
      - `<Kicker>` ← `category`
      - `<Headline>` ← `title` → `/posts/{id}`
      - `<Dek>` ← `excerpt`
      - `<ActivityLine>` ← `is_activity` `starts_at` `location`
      - `<Dateline>` ← `created_at`
  - `<EmptyCategory>` `total===0` 时
  - `<Pagination>` 显示条件用 `page` `page_size` `total`；请求 Query `page`

- `<Page: PostDetail>`
  - `<ErrorBanner>` 或 `<NotFoundHed>` ← `error.code` `error.message`
  - `<Article>`
    - `<Kicker>` ← `category`
    - `<Headline>` ← `title`
    - `<Byline>` ← `author.display_name` `created_at`
    - `<ActivityLine>` ← `is_activity` `starts_at` `location`
    - `<ImageWell>`
    - `<Body>` ← `body`
    - 不展示 `status`、`email`、`excerpt`（详情以 `body` 为准）
    - Community 时 `<CommentThread>` ← `GET .../comments` 的 `items[]`（`floor` `body` `author` `replies`）
    - Community 且编辑时 `<PromoteForm>` Request `category` `title` `body`

- `<Page: MyPosts>`
  - `<SectionRule>` MY POSTS
  - `<ErrorBanner>` ← `error.message`
  - `<StoryRowList>` ← `GET /me/posts` 的 `items`（字段同栏目行 + `author.display_name` 可不重复强调，因都是自己）
  - `<EmptyMine>` `total===0`

- `<Page: SignIn>`
  - `<AuthForm>` Request `email` `password`
  - `<ErrorBanner>` ← `error.message`（`invalid_credentials` / 503）
  - `<FieldError>` ← `error.fields[]`
  - 链到 `/register`

- `<Page: Register>`
  - `<AuthForm>` Request `email` `password` `display_name`
  - `<FieldError>` ← `email_taken` / `validation_error` 的 `fields[]`
  - 链到 `/sign-in`

- `<Page: AdminUsers>`
  - `<SectionRule>` USERS
  - `<ErrorBanner>` ← `error.message`
  - 行 ← `items[]` 的 `display_name` `email` `role`

`StoryTile` / `StoryRow` / `FeaturedLead` 共用绑定：`id` `title` `excerpt` `category` `is_activity` `starts_at` `location` `created_at` `author.id` `author.display_name`。列表不绑 `body`。

---

## 5. 交互要点

主路径（P1-US1）：注册或登录 → 在对应栏目 Write 发帖 → 该栏目列表能读到。

| 用户动作 | 请求 | 成功 | 失败 |
| --- | --- | --- | --- |
| 打开站点 | `GET /api/v1/me` | 顶栏用 `display_name` | `401`：顶栏 SIGN IN，不当错误条 |
| 打开 `/` | `GET /api/v1/posts?page=1&page_size=20` | 按槽位绑 `items` | `ErrorBanner` ← `error.message` |
| 点故事 | — | 去 `/posts/{id}` | — |
| 点导航栏目 | `GET /api/v1/posts?category={enum}` | `StoryRowList` | 栏目下错误条 |
| 打开详情 | `GET /api/v1/posts/{post_id}` | 绑 `PostDetail` | `404` 文案；`503` 错误条 |
| Community 详情 | `GET /api/v1/posts/{id}/comments` | 楼层与楼中楼 | `422` 不在四栏页出现 |
| 跟帖 | `POST .../comments` | 追加楼或楼中楼 | 401 去登录；422 字段下 |
| 精选 | `POST .../promote` | 去新帖 `/posts/{id}` | 403 / 422 错误条 |
| Community 未登录点发帖 | — | 去 `/sign-in?next=/community` | — |
| 栏目内 Write | — | 本页展开锁栏目表单 | 学生在四栏无按钮 |
| Sign in 提交 | `POST /api/v1/auth/login` body `email` `password` | 去 `next` 或 `/` | 表单上沿 `error.message`；字段错 `fields[]` |
| Register 提交 | `POST /api/v1/auth/register` body `email` `password` `display_name` | 同上 | `409` 写在 email 下 |
| Sign out | `POST /api/v1/auth/logout` | 顶栏变 SIGN IN；若在 `/me/posts` 则去 `/` | `401`：已当访客 |
| Publish | `POST /api/v1/posts`；Community 可再 `POST .../images` | 收起表单，新帖出现在本栏目列表顶 | 422 字段下；401 去登录；503 表单顶。**不**乐观插入首页 |
| 打开我的帖子 | `GET /api/v1/me/posts?page=1&page_size=20` | 列表 | 401 去登录；503 错误条 |
| Older stories | 同一列表接口 `page` 递增 | 追加或换页 `items` | `bad_request` 错误条 |
| 搜索提交 | 无 | 静态说明 | — |

`is_activity` 切到 false 时清空并提交 `starts_at: null`、`location: null`。切到 true 时须填时间与地点再 Publish。

活动时间展示：把 `starts_at` 格式化为本地可读（如 `September 13 · 5:00 PM`），绑定仍是该字段。地点原样显示 `location`。
