# BBGM Scoop API 契约（第一版）

依据：`docs/PRD.md` Must Have 与 Entity Flow。本文件同时约束前端 Mock 与后端实现。不包含业务代码。

第一版 **无公开审计查询接口**（M10 仅服务端落库）。不包含编辑 / 删除帖或评论 / 检索（Should）。包含 Community 评论（楼中楼）、角色与精选复制。

---

## 0. 约定

### Base URL

```
/api/v1
```

默认 JSON：`Content-Type: application/json`。例外：`POST /api/v1/me/avatar` 与 `POST /api/v1/posts/{post_id}/images` 为 `multipart/form-data`（字段名 `file`）。

### 鉴权

Cookie Session。

- Cookie 名：`scoop_session`
- 属性：`HttpOnly`、`SameSite=Lax`、`Path=/`。生产环境加 `Secure`
- 登录、注册成功时由服务端 `Set-Cookie`
- 退出时清除该 Cookie
- 浏览器跨请求自动带 Cookie；前端 Mock 需模拟「已登录 / 未登录」两组

**需要鉴权的请求**在缺少有效会话时：

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Please sign in to continue.",
    "fields": []
  }
}
```

公开读接口（栏目列表、详情、首页列表、Community 评论列表）**不**要求鉴权。

### 通用错误包络

所有 4xx / 5xx 均为此形状。`fields` 仅用于字段级校验；其他错误给 `[]`。

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "fields": [
      { "field": "string", "message": "string" }
    ]
  }
}
```

| HTTP | `error.code` | 何时 |
| --- | --- | --- |
| 400 | `bad_request` | 分页参数非法等无法归到字段校验的请求错误 |
| 401 | `unauthenticated` | 无会话或会话无效 |
| 401 | `invalid_credentials` | 登录邮箱或密码不对（不区分「用户不存在」与「密码错误」） |
| 403 | `forbidden` | 已登录但无权（学生发四栏、非编辑精选、非管理员改角色） |
| 404 | `not_found` | 帖子、评论父楼或用户不存在 |
| 409 | `email_taken` | 注册邮箱已被占用 |
| 422 | `validation_error` | 缺必填、超长、非法栏目、活动缺时间/地点 |
| 503 | `storage_unavailable` | 存储写入失败；不得返回成功或半截资源 |

成功响应不包 `{ "data": ... }` 中间层：对象或列表字段直接放在 JSON 根上。

### 时间、id、分页

| 项 | 约定 |
| --- | --- |
| id | 字符串 UUID v4，创建后不变 |
| 时间 | UTC，ISO 8601 且带 `Z`，例如 `2026-09-07T14:30:00Z` |
| 分页 Query | `page` 整数 ≥ 1，默认 `1`；`page_size` 整数 1–50，默认 `20` |
| 分页非法 | `400` + `bad_request` |
| 列表成功 | `{ "items": [...], "page", "page_size", "total" }`；空列表 `items` 为 `[]`，`total` 为 `0` |
| 排序 | 已发布帖按 `created_at` 降序；Community 楼层按 `created_at` 升序（楼号 1 起） |

### 共享字段形状

**AuthorPublic**（对外帖子中的作者，不含邮箱）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 用户 id |
| `display_name` | string | 展示名 |
| `avatar` | string | `preset:{oak\|gym\|book\|dorm\|bus\|night}` 或同源上传路径 `/uploads/avatars/{id}.{ext}`。缺省按 `preset:oak` |

**UserPrivate**（当前登录用户）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | |
| `email` | string | |
| `display_name` | string | |
| `role` | string | `student` \| `editor` \| `admin` |
| `avatar` | string | 同 AuthorPublic |
| `created_at` | string | |

**PostSummary**（列表：首页、栏目、我的帖子）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | |
| `title` | string | |
| `excerpt` | string | 由 `body` 截断，最多 160 字，供卡片绑定；不是另一份正文 |
| `category` | string | `news` \| `dorm_life` \| `sports` \| `events` \| `community` |
| `is_activity` | boolean | |
| `starts_at` | string \| null | 活动必有；非活动为 `null` |
| `location` | string \| null | 活动必有；非活动为 `null` |
| `status` | string | 本版恒为 `published` |
| `created_at` | string | |
| `updated_at` | string | 创建时与 `created_at` 相同 |
| `author` | AuthorPublic | |
| `reply_count` | integer | 楼层数。四栏与无 `category` 的列表为 `0` |
| `reply_preview` | ReplyPreview[] | Community 最多 4 条楼层（无楼中楼）。其他列表为 `[]` |
| `images` | string[] | Community 配图，同源路径 `/uploads/posts/{post_id}/{file}`，最多 4 张。四栏与无 `category` 的列表为 `[]` |

**ReplyPreview**（Community 卡片用）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 楼层 id |
| `body` | string | |
| `created_at` | string | |
| `author` | AuthorPublic | |

**PostDetail** = PostSummary 的全部字段 + `body`（string，完整正文，自由文本）。

**CommentReply**（楼中楼，挂在某一楼层下）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | |
| `body` | string | |
| `parent_id` | string | 所属楼层 id |
| `created_at` | string | |
| `author` | AuthorPublic | |

**CommentFloor**（楼层）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | |
| `body` | string | |
| `parent_id` | null | 楼层恒为 `null` |
| `floor` | integer | 全帖楼号，从 1 起，按楼层 `created_at` 升序 |
| `created_at` | string | |
| `author` | AuthorPublic | |
| `replies` | CommentReply[] | 该楼的楼中楼，按 `created_at` 升序 |

密码、`password_hash`、审计记录 **永不**出现在响应里。

---

## 1. 接口列表

### 1.1 Auth

#### `POST /api/v1/auth/register`

- **鉴权：** 否
- **职责：** 注册学生账号；成功则创建用户、建立会话并 `Set-Cookie`。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `email` | string | 是 | 有效邮箱，大小写不敏感，存储前规范化为小写 |
| `password` | string | 是 | 8–128 字符 |
| `display_name` | string | 是 | 去掉首尾空白后 1–40 字符 |

**Response**

- `201` + `UserPrivate`；`Set-Cookie: scoop_session=...`
- `409` `email_taken`
- `422` `validation_error`（缺字段、邮箱非法、密码过短、展示名为空）
- `503` `storage_unavailable`

---

#### `POST /api/v1/auth/login`

- **鉴权：** 否
- **职责：** 校验邮箱密码，建立会话。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `email` | string | 是 | 邮箱 |
| `password` | string | 是 | 非空 |

**Response**

- `200` + `UserPrivate`；`Set-Cookie: scoop_session=...`
- `401` `invalid_credentials`（邮箱不存在或密码错误，同一文案）
- `422` `validation_error`
- `503` `storage_unavailable`（读存储失败时）

---

#### `POST /api/v1/auth/logout`

- **鉴权：** 是
- **职责：** 作废当前会话并清除 Cookie。

**Request：** 无 body。

**Response**

- `204` 无 body；`Set-Cookie` 过期 `scoop_session`
- `401` `unauthenticated`

---

#### `GET /api/v1/me`

- **鉴权：** 是
- **职责：** 返回当前会话用户，供导航与栏目内发帖判断登录态。

**Request：** 无。

**Response**

- `200` + `UserPrivate`
- `401` `unauthenticated`

---

#### `PUT /api/v1/me/avatar`

- **鉴权：** 是
- **职责：** 换成自带预设头像。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `preset` | string | 是 | `oak` \| `gym` \| `book` \| `dorm` \| `bus` \| `night` |

**Response**

- `200` + `UserPrivate`（`avatar` 为 `preset:{preset}`）
- `401` `unauthenticated`
- `422` `validation_error`
- `503` `storage_unavailable`

---

#### `POST /api/v1/me/avatar`

- **鉴权：** 是
- **职责：** 上传一张头像。`Content-Type: multipart/form-data`，字段名 `file`。jpeg / png / webp，≤1MB。

**Response**

- `200` + `UserPrivate`（`avatar` 为 `/uploads/avatars/{user_id}.{ext}`）
- `401` `unauthenticated`
- `422` `validation_error`（类型或大小非法）
- `503` `storage_unavailable`

---

### 1.2 Posts

#### `GET /api/v1/posts`

- **鉴权：** 否
- **职责：** 列出已发布帖。无 `category` 时供首页近期露出，**只含四栏**（`news` `dorm_life` `sports` `events`），不含 Community。有 `category` 时只返回该栏目（含 `community`）。

**Query**

| 参数 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `category` | string | 否 | 若出现必须是 `news` \| `dorm_life` \| `sports` \| `events` \| `community` |
| `page` | integer | 否 | ≥ 1，默认 1 |
| `page_size` | integer | 否 | 1–50，默认 20 |

**Response**

- `200` `{ items: PostSummary[], page, page_size, total }`
- `400` `bad_request`（`page` / `page_size` 非法）
- `422` `validation_error`（`category` 有值但不在枚举内）
- `503` `storage_unavailable`

列表项必须带上 `is_activity`、`starts_at`、`location`，读者无需点进详情也能判断是否为活动（P3-US2）。

---

#### `GET /api/v1/posts/{post_id}`

- **鉴权：** 否
- **职责：** 已发布帖详情（含完整 `body`）。

**路径参数**

| 参数 | 类型 | 约束 |
| --- | --- | --- |
| `post_id` | string | UUID |

**Response**

- `200` + `PostDetail`
- `400` `bad_request`（`post_id` 不是 UUID）
- `404` `not_found`
- `503` `storage_unavailable`

---

#### `POST /api/v1/posts`

- **鉴权：** 是
- **职责：** 当前用户发布帖子，状态直接为 `published`；服务端同时写审计（不在响应中返回）。`student` 只能发 `community` 且 `is_activity=false`。`editor` / `admin` 可发四栏或 Community。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `title` | string | 是 | 去掉首尾空白后 1–120 字符 |
| `body` | string | 是 | 去掉首尾空白后 1–20000 字符 |
| `category` | string | 是 | `news` \| `dorm_life` \| `sports` \| `events` \| `community` |
| `is_activity` | boolean | 是 | `community` 必须为 `false` |
| `starts_at` | string \| null | 条件 | `is_activity=true` 时必填，ISO 8601 UTC；`false` 时必须 `null` 或不传（视为 `null`） |
| `location` | string \| null | 条件 | `is_activity=true` 时去掉空白后 1–200 字符；`false` 时必须 `null` 或不传 |

作者取当前会话用户，客户端不可传 `author_id` / `status`。

**Response**

- `201` + `PostDetail`（含服务端生成的 `id`、`excerpt`、`created_at`、`updated_at`、`author`、`status=published`）
- `401` `unauthenticated`
- `403` `forbidden`（`student` 发四栏）
- `422` `validation_error`（缺标题/正文/栏目、非法栏目、活动缺 `starts_at` 或 `location`、非活动却带活动字段、Community 标为活动）
- `503` `storage_unavailable`（帖子与审计任一写入失败则整笔失败，不返回 201）

创建成功时 `images` 为 `[]`。配图用下面的上传接口追加。

---

#### `POST /api/v1/posts/{post_id}/images`

- **鉴权：** 是（须该帖作者）
- **职责：** 给 Community 主帖追加一张图。`Content-Type: multipart/form-data`，字段名 `file`。jpeg / png / webp，≤2MB。每帖最多 4 张。

**Response**

- `200` + `PostDetail`（`images` 含新路径 `/uploads/posts/{post_id}/{id}.{ext}`）
- `401` `unauthenticated`
- `403` `forbidden`（不是作者）
- `404` `not_found`
- `422` `validation_error`（非 Community、已满 4 张、类型或大小非法）
- `503` `storage_unavailable`

---

#### `GET /api/v1/me/posts`

- **鉴权：** 是
- **职责：** 当前用户自己发过的帖（P1-US2），含已发布内容。

**Query：** 与列表相同的 `page`、`page_size`（无 `category` 过滤；「我的帖子」含 Community 与四栏）。

**Response**

- `200` `{ items: PostSummary[], page, page_size, total }`
- `400` `bad_request`
- `401` `unauthenticated`
- `503` `storage_unavailable`

---

### 1.3 Comments

#### `GET /api/v1/posts/{post_id}/comments`

- **鉴权：** 否
- **职责：** 列出 Community 帖的楼层（含楼中楼）。分页作用在**楼层**上。`floor` 是全帖楼号，不是当前页内序号。

**Query：** `page`、`page_size`（同通用分页）。

**Response**

- `200` `{ items: CommentFloor[], page, page_size, total }`（`total` 为楼层总数）
- `400` `bad_request`（非法 `post_id` 或分页）
- `404` `not_found`（帖不存在）
- `422` `validation_error`（帖存在但不是 Community）
- `503` `storage_unavailable`

#### `POST /api/v1/posts/{post_id}/comments`

- **鉴权：** 是
- **职责：** 在 Community 帖下发楼层或楼中楼。本版不能改删评论。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `body` | string | 是 | 去掉首尾空白后 1–4000 字符 |
| `parent_id` | string \| null | 否 | 不传或 `null` = 新楼层；若传则必须是**该帖的楼层** id，禁止回复楼中楼 |

**Response**

- `201` + 所创建的 `CommentFloor`（新楼，`replies` 为 `[]`）或 `CommentReply`
- `401` `unauthenticated`
- `404` `not_found`（帖或 `parent_id` 楼层不存在）
- `422` `validation_error`（非 Community 帖、正文非法、`parent_id` 不是该帖楼层）
- `503` `storage_unavailable`

### 1.4 Promote

#### `POST /api/v1/posts/{post_id}/promote`

- **鉴权：** 是（须 `editor` 或 `admin`）
- **职责：** 把 Community 帖复制成一篇四栏新帖；源帖不改。作者为当前编辑。同时写审计。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `category` | string | 是 | `news` \| `dorm_life` \| `sports` \| `events`（不能是 `community`） |
| `title` | string | 否 | 若传：1–120 字符；不传则用源帖标题 |
| `body` | string | 否 | 若传：1–20000 字符；不传则用源帖正文 |
| `is_activity` | boolean | 否 | 默认 `false` |
| `starts_at` | string \| null | 条件 | 与发帖相同的活动规则 |
| `location` | string \| null | 条件 | 与发帖相同的活动规则 |

**Response**

- `201` + 新帖 `PostDetail`（`images` 为 `[]`，不复制源帖配图）
- `401` `unauthenticated`
- `403` `forbidden`（`student`）
- `404` `not_found`（源帖不存在）
- `422` `validation_error`（源帖不是 Community、栏目非法、活动字段非法）
- `503` `storage_unavailable`

### 1.5 Admin users

#### `GET /api/v1/admin/users`

- **鉴权：** 是（须 `admin`）
- **职责：** 分页列出用户，供授予 / 取消编辑。

**Query：** `page`、`page_size`。排序按 `created_at` 降序。

**Response**

- `200` `{ items: UserPrivate[], page, page_size, total }`
- `400` `bad_request`
- `401` `unauthenticated`
- `403` `forbidden`（非 `admin`）
- `503` `storage_unavailable`

#### `PATCH /api/v1/admin/users/{user_id}`

- **鉴权：** 是（须 `admin`）
- **职责：** 将目标用户设为 `editor` 或 `student`。

**Request body**

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `role` | string | 是 | 仅 `student` \| `editor` |

**Response**

- `200` + 更新后的 `UserPrivate`
- `401` `unauthenticated`
- `403` `forbidden`（调用者不是 `admin`；或目标已是 `admin`；或试图写成 `admin`）
- `404` `not_found`
- `422` `validation_error`（`role` 非法）
- `503` `storage_unavailable`

`ADMIN_EMAIL`（环境变量，小写邮箱）在注册或登录时把该用户升为 `admin`。不要把真实邮箱写进仓库。

### 1.6 本版不提供的写接口（避免前后端各写一套）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `PATCH` / `DELETE` | `/api/v1/posts/{post_id}` | Should（S2）。若误调用：`405`。PRD AC12 在本版通过「无改删接口」满足。 |
| `PATCH` / `DELETE` | `/api/v1/posts/{post_id}/comments/{comment_id}` | 本版不能改删评论。若误调用：`405`。 |
| `GET` | `/api/v1/audit-events` | Should（S5）。审计只写不读。 |

---

## 2. Mock 数据

内容贴合 P1 发帖学生、P2 读者、P3 活动组织者。账号为虚构 BBGM 学生，禁止 `foo` / `test`。

公共 id（前端可把同一人串起来）：

| 谁 | `id` | 角色 |
| --- | --- | --- |
| Jordan Hale | `8f2a1c6e-4b90-4d3a-9e1f-2c7b0d84a511` | P1 发帖：宿舍讨论 |
| Priya Nair | `c3d9e0a4-1f27-4b8c-a056-9e4d2b71c880` | P3 组织者：体育活动 |
| Wei Chen | `a11b2203-88e4-4f0d-b7c1-5d9a3e2f0146` | 读者向 News 帖作者 |

---

### 2.1 `POST /api/v1/auth/register`

**成功 `201`**

```json
{
  "id": "8f2a1c6e-4b90-4d3a-9e1f-2c7b0d84a511",
  "email": "jordan.hale@bbgm.edu",
  "display_name": "Jordan Hale",
  "role": "student",
  "created_at": "2026-09-10T11:02:18Z"
}
```

**错误 `409`（邮箱已注册）**

```json
{
  "error": {
    "code": "email_taken",
    "message": "An account with this email already exists.",
    "fields": [
      { "field": "email", "message": "This email is already registered." }
    ]
  }
}
```

---

### 2.2 `POST /api/v1/auth/login`

**成功 `200`**（Priya 登录后去发比赛预告）

```json
{
  "id": "c3d9e0a4-1f27-4b8c-a056-9e4d2b71c880",
  "email": "priya.nair@bbgm.edu",
  "display_name": "Priya Nair",
  "role": "editor",
  "created_at": "2026-08-21T09:10:00Z"
}
```

**错误 `401`（凭据无效）**

```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "Email or password is incorrect.",
    "fields": []
  }
}
```

---

### 2.3 `POST /api/v1/auth/logout`

**成功 `204`**

（无 body）

**错误 `401`**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Please sign in to continue.",
    "fields": []
  }
}
```

---

### 2.4 `GET /api/v1/me`

**成功 `200`**

```json
{
  "id": "8f2a1c6e-4b90-4d3a-9e1f-2c7b0d84a511",
  "email": "jordan.hale@bbgm.edu",
  "display_name": "Jordan Hale",
  "role": "student",
  "created_at": "2026-09-10T11:02:18Z"
}
```

**错误 `401`**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Please sign in to continue.",
    "fields": []
  }
}
```

---

### 2.5 `GET /api/v1/posts`（首页，无 category）

**成功 `200`**

```json
{
  "items": [
    {
      "id": "5e8c41b2-9d70-4aa1-8c3e-0b6f2d9a4471",
      "title": "East Hall laundry room will close Friday night",
      "excerpt": "Facilities posted a handwritten note on the basement door: the dryers are being replaced this weekend. Bring quarters to West Hall if you still need a machine tonight.",
      "category": "dorm_life",
      "is_activity": false,
      "starts_at": null,
      "location": null,
      "status": "published",
      "created_at": "2026-09-10T16:40:12Z",
      "updated_at": "2026-09-10T16:40:12Z",
      "author": {
        "id": "8f2a1c6e-4b90-4d3a-9e1f-2c7b0d84a511",
        "display_name": "Jordan Hale"
      }
    },
    {
      "id": "b7a02f19-3c54-4e8d-91aa-6d2c0e8f3310",
      "title": "Intramural basketball finals — Saturday at the old gym",
      "excerpt": "East Hall plays the faculty pick-up team for the dorm cup. Doors open at 16:30; bring student ID. We still need two table scorers.",
      "category": "sports",
      "is_activity": true,
      "starts_at": "2026-09-13T17:00:00Z",
      "location": "Old Gym, Court 2",
      "status": "published",
      "created_at": "2026-09-10T14:05:44Z",
      "updated_at": "2026-09-10T14:05:44Z",
      "author": {
        "id": "c3d9e0a4-1f27-4b8c-a056-9e4d2b71c880",
        "display_name": "Priya Nair"
      }
    },
    {
      "id": "0d41e8aa-6b2f-4c77-9e01-8a5b3c12d990",
      "title": "Library 24-hour desks start the week before midterms",
      "excerpt": "The third-floor quiet wing will stay open overnight from 21 September. Snacks are allowed in the lobby only; no sleeping bags.",
      "category": "news",
      "is_activity": false,
      "starts_at": null,
      "location": null,
      "status": "published",
      "created_at": "2026-09-09T08:15:03Z",
      "updated_at": "2026-09-09T08:15:03Z",
      "author": {
        "id": "a11b2203-88e4-4f0d-b7c1-5d9a3e2f0146",
        "display_name": "Wei Chen"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 3
}
```

**空态 `200`**（新栏目尚无帖，供前端空列表）

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

**错误 `422`（非法栏目）**

`GET /api/v1/posts?category=gossip`

```json
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields are invalid.",
    "fields": [
      { "field": "category", "message": "Must be one of: news, dorm_life, sports, events, community." }
    ]
  }
}
```

---

### 2.6 `GET /api/v1/posts?category=events`

**成功 `200`**（大型活动栏目；列表即可读时间地点）

```json
{
  "items": [
    {
      "id": "91c4d2e8-0a17-4b5f-8e33-7c1a9d04b226",
      "title": "Back-to-hall mixer: all East and West residents",
      "excerpt": "RA council is hosting the first mixer of term. No ticket, but you need a dorm lanyard at the door. Playlist sign-up on the whiteboard.",
      "category": "events",
      "is_activity": true,
      "starts_at": "2026-09-12T11:00:00Z",
      "location": "School Auditorium lobby",
      "status": "published",
      "created_at": "2026-09-08T19:22:10Z",
      "updated_at": "2026-09-08T19:22:10Z",
      "author": {
        "id": "c3d9e0a4-1f27-4b8c-a056-9e4d2b71c880",
        "display_name": "Priya Nair"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

**错误 `400`（分页非法）**

`GET /api/v1/posts?category=events&page=0`

```json
{
  "error": {
    "code": "bad_request",
    "message": "page must be an integer greater than or equal to 1.",
    "fields": []
  }
}
```

---

### 2.7 `GET /api/v1/posts/{post_id}`

**成功 `200`**（Jordan 的宿舍帖全文）

```json
{
  "id": "5e8c41b2-9d70-4aa1-8c3e-0b6f2d9a4471",
  "title": "East Hall laundry room will close Friday night",
  "excerpt": "Facilities posted a handwritten note on the basement door: the dryers are being replaced this weekend. Bring quarters to West Hall if you still need a machine tonight.",
  "body": "Facilities posted a handwritten note on the basement door: the dryers are being replaced this weekend. Bring quarters to West Hall if you still need a machine tonight.\n\nThe note says work starts at 18:00 Friday and should finish Sunday afternoon. If you already left clothes in a machine, the RAs will bag them and leave them on the folding table.\n\nWest Hall basement is staying open. It was packed last time the East machines died, so go early.",
  "category": "dorm_life",
  "is_activity": false,
  "starts_at": null,
  "location": null,
  "status": "published",
  "created_at": "2026-09-10T16:40:12Z",
  "updated_at": "2026-09-10T16:40:12Z",
  "author": {
    "id": "8f2a1c6e-4b90-4d3a-9e1f-2c7b0d84a511",
    "display_name": "Jordan Hale"
  }
}
```

**错误 `404`**

```json
{
  "error": {
    "code": "not_found",
    "message": "Post not found.",
    "fields": []
  }
}
```

---

### 2.8 `POST /api/v1/posts`

**成功 `201`**（Priya 发体育活动帖）

请求示例（非响应，便于 Mock 对照）：

```json
{
  "title": "Intramural basketball finals — Saturday at the old gym",
  "body": "East Hall plays the faculty pick-up team for the dorm cup. Doors open at 16:30; bring student ID. We still need two table scorers.\n\nCheer section is first come, first served on the bleachers. No outside horns.",
  "category": "sports",
  "is_activity": true,
  "starts_at": "2026-09-13T17:00:00Z",
  "location": "Old Gym, Court 2"
}
```

响应：

```json
{
  "id": "b7a02f19-3c54-4e8d-91aa-6d2c0e8f3310",
  "title": "Intramural basketball finals — Saturday at the old gym",
  "excerpt": "East Hall plays the faculty pick-up team for the dorm cup. Doors open at 16:30; bring student ID. We still need two table scorers.",
  "body": "East Hall plays the faculty pick-up team for the dorm cup. Doors open at 16:30; bring student ID. We still need two table scorers.\n\nCheer section is first come, first served on the bleachers. No outside horns.",
  "category": "sports",
  "is_activity": true,
  "starts_at": "2026-09-13T17:00:00Z",
  "location": "Old Gym, Court 2",
  "status": "published",
  "created_at": "2026-09-10T14:05:44Z",
  "updated_at": "2026-09-10T14:05:44Z",
  "author": {
    "id": "c3d9e0a4-1f27-4b8c-a056-9e4d2b71c880",
    "display_name": "Priya Nair"
  }
}
```

**错误 `422`（活动缺地点；对应 PRD AC11 / P1-US3）**

```json
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields are invalid.",
    "fields": [
      { "field": "location", "message": "Location is required when this post is an activity." }
    ]
  }
}
```

**错误 `401`（未登录发帖；对应 PRD AC9）**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Please sign in to continue.",
    "fields": []
  }
}
```

**错误 `503`（存储失败；对应 PRD AC13）**

```json
{
  "error": {
    "code": "storage_unavailable",
    "message": "Could not save the post. Try again in a moment.",
    "fields": []
  }
}
```

---

### 2.9 `GET /api/v1/me/posts`

**成功 `200`**（Jordan 查看自己发出的宿舍帖）

```json
{
  "items": [
    {
      "id": "5e8c41b2-9d70-4aa1-8c3e-0b6f2d9a4471",
      "title": "East Hall laundry room will close Friday night",
      "excerpt": "Facilities posted a handwritten note on the basement door: the dryers are being replaced this weekend. Bring quarters to West Hall if you still need a machine tonight.",
      "category": "dorm_life",
      "is_activity": false,
      "starts_at": null,
      "location": null,
      "status": "published",
      "created_at": "2026-09-10T16:40:12Z",
      "updated_at": "2026-09-10T16:40:12Z",
      "author": {
        "id": "8f2a1c6e-4b90-4d3a-9e1f-2c7b0d84a511",
        "display_name": "Jordan Hale"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

**错误 `401`**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Please sign in to continue.",
    "fields": []
  }
}
```
