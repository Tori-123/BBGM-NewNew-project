# CJ Online

为 BASIS Bilingual Guangming 在校学生设计的线上 Communication Journal。

## 已有功能

- 首页提供整月日历，点击任意一周即可进入对应的 CJ。
- 周一至周五采用五列同时展示，不需要逐日切换。
- 每条 CJ 完整展示 `Subject`、`IC`、`HW`、`A`。
- 学生可为 Period 1–8 分别选择任意学科，选择结果保存在当前设备并应用到整周。
- 每周设有独立的考试时间列表，包含日期、时间、地点和备注。
- 管理端可创建或更新指定周、日期和课程的 CJ，也可编辑考试安排。
- 数据使用 Cloudflare D1 持久化，网页与数据接口可以继续接入其他校内网站。
- 支持手机与桌面浏览。

## 主要目录

- `app/month-calendar.tsx`：月历入口。
- `app/cj-board.tsx`：整周学生端。
- `app/admin/admin-editor.tsx`：管理端。
- `app/api/cj/route.ts`：数据读取与管理员编辑接口。
- `app/api/exams/route.ts`：考试安排编辑接口。
- `db/schema.ts`：数据库结构。
- `drizzle/`：数据库迁移文件。
- `.openai/hosting.json`：Sites 托管配置。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run build
```

首次本地运行数据库时，依次应用 `drizzle/0000_wide_eternity.sql` 和 `drizzle/0001_loving_malice.sql`，再运行：

```bash
npm run dev
```

月历入口：`http://127.0.0.1:5173/`

周 CJ：`http://127.0.0.1:5173/week`

管理端：`http://127.0.0.1:5173/admin`

本地预览管理员口令为 `CJ-DEMO`。正式上线时必须配置独立的 `CJ_ADMIN_CODE`，不要在源代码中保存真实口令。

## 上线前

1. 设置正式管理员口令 `CJ_ADMIN_CODE`。
2. 运行构建并应用 D1 迁移。
3. 发布后分别验证学生端读取、课程筛选和管理端保存。
