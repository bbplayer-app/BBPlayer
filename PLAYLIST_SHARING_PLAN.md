## Plan（最终版）：歌单分享与云同步

### 核心设计原则

- **时间戳增量同步**：所有变更以 `updated_at`/`deleted_at` 驱动，客户端用 `lastShareSyncAt` 记录上次同步时间
- **LWW 冲突解决**：以客户端操作时间（`operation_at`）为准，而非服务端写入时间，避免网络延迟导致"旧操作伪装成新操作"的问题
- **最小侵入**：只改 4 个 service 层函数，不动任何 hook 调用点
- **云同步**：`GET /api/me/playlists` 作为换设备后的恢复入口

---

## 一、后端（新建 `apps/backend`）

### 技术栈

Hono + Drizzle ORM + Supabase PostgreSQL + Cloudflare Workers

### 数据库 Schema

```
users
  mid         bigint PK         B站 mid
  name        text
  face        text
  last_login_at timestamptz
  jwt_version int DEFAULT 0    用于 token 失效

shared_playlists
  id          uuid PK DEFAULT gen_random_uuid()
  owner_mid   bigint FK→users
  title       text NOT NULL
  description text
  cover_url   text
  created_at  timestamptz DEFAULT now()
  updated_at  timestamptz DEFAULT now()
  deleted_at  timestamptz                -- 软删除

playlist_members                          -- 权限/参与者/订阅者
  playlist_id uuid FK→shared_playlists
  mid         bigint FK→users
  role        text CHECK IN ('owner','editor','subscriber')
  joined_at   timestamptz DEFAULT now()
  PK: (playlist_id, mid)

shared_tracks                             -- 曲目资源池，跨歌单去重
  unique_key  text PK                    -- 与移动端 unique_key 相同
  title       text NOT NULL
  artist_name text                        -- 反归一化，简化查询
  artist_id   text                        -- 可能是 mid 或其他标识
  cover_url   text
  duration    int
  bilibili_bvid text NOT NULL
  bilibili_cid  int
  created_at  timestamptz DEFAULT now()
  updated_at  timestamptz DEFAULT now()

shared_playlist_tracks
  playlist_id     uuid FK→shared_playlists
  track_unique_key text FK→shared_tracks
  sort_key        text NOT NULL           -- fractional indexing，与移动端格式一致
  added_by_mid    bigint FK→users
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()  -- reorder 时也更新此字段
  deleted_at      timestamptz                -- 软删除，驱动增量同步
  PK: (playlist_id, track_unique_key)
  INDEX: (playlist_id, updated_at)
  INDEX: (playlist_id, deleted_at)
```

### 7 个 API 端点

| #   | 方法  | 路径                           | 权限             | 说明                                         |
| --- | ----- | ------------------------------ | ---------------- | -------------------------------------------- |
| 1   | POST  | `/api/auth/login`              | 无               | B站 cookie 验证 → 返回 JWT                   |
| 2   | GET   | `/api/me/playlists`            | JWT              | 获取当前用户参与的所有歌单（换设备恢复入口） |
| 3   | POST  | `/api/playlists`               | JWT              | 创建共享歌单，支持携带初始曲目               |
| 4   | PATCH | `/api/playlists/:id`           | JWT owner        | 修改元数据                                   |
| 5   | POST  | `/api/playlists/:id/changes`   | JWT owner/editor | 增量上传变更                                 |
| 6   | GET   | `/api/playlists/:id/changes`   | JWT member       | 增量拉取变更                                 |
| 7   | POST  | `/api/playlists/:id/subscribe` | JWT              | 订阅歌单（通过分享链接进入）                 |

#### 关键接口设计

**POST `/api/playlists/:id/changes`**（上传）

```typescript
// Request body
{
  changes: [
    // operation_at 是用户执行操作的时间（客户端入队时记录），不是上传时间
    { op: 'upsert', track: { unique_key, title, ... }, sort_key: 'a0', operation_at: 1740000000000 },
    { op: 'remove', track_unique_key: 'bilibili:bvid:cid', operation_at: 1740000000100 },
    { op: 'reorder', track_unique_key: 'bilibili:bvid:cid', sort_key: 'a1', operation_at: 1740000000200 },
  ]
}
// Response
{ applied_at: 1740000000000 }  // 服务端时间戳，客户端存为 lastShareSyncAt
```

**服务端 LWW 写入逻辑**（关键）：

```sql
-- upsert/reorder：只在 operation_at 更新时才写入，用操作时间而非 NOW()
UPDATE shared_playlist_tracks
  SET sort_key = :sort_key,
      updated_at = :operation_at        -- 用客户端操作时间
WHERE playlist_id = :pid
  AND track_unique_key = :key
  AND updated_at < :operation_at;       -- LWW：旧操作不覆盖新操作

-- remove：同理
UPDATE shared_playlist_tracks
  SET deleted_at = :operation_at
WHERE playlist_id = :pid
  AND track_unique_key = :key
  AND COALESCE(updated_at, created_at) < :operation_at;
```

这样即使设备A 的"删除"操作因网络问题延迟上传，`operation_at` 仍是用户执行删除的那一刻，不会错误覆盖掉设备B 后续的"添加"操作。

**GET `/api/playlists/:id/changes?since=<ms>`**（拉取）

```typescript
// Response
{
  metadata: { title, description, cover_url, updated_at } | null,  // null 表示此字段无变化
  tracks: [
    { op: 'upsert', track: {...}, sort_key: 'a0', updated_at: 123 },
    { op: 'delete', track_unique_key: '...', deleted_at: 456 }
  ],
  has_more: false,
  server_time: 1740000000000   // 客户端将此值存为新的 lastShareSyncAt
}
```

**注**：客户端始终用服务端返回的 `server_time` 更新 `lastShareSyncAt`，而非用本地时钟，消除时钟偏差问题。

---

## 二、前端

### 1. SQLite Schema 变更

schema.ts 中两处改动：

**`playlists` 表新增 3 个字段**（不改动现有 `remoteSyncId`，保留与 B 站同步的用途）：

```typescript
shareId: text('share_id'),             // 对应后端 shared_playlists.id (UUID)
shareRole: text('share_role', {
  enum: ['owner', 'editor', 'subscriber']
}),                                    // null 表示纯本地歌单
lastShareSyncAt: integer('last_share_sync_at', { mode: 'timestamp_ms' }),
```

**新增 `playlist_sync_queue` 表**：

```typescript
export const playlistSyncQueue = sqliteTable('playlist_sync_queue', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playlistId: integer('playlist_id')
		.notNull()
		.references(() => playlists.id, { onDelete: 'cascade' }),
	operation: text('operation', {
		enum: ['add_tracks', 'remove_tracks', 'reorder_track', 'update_metadata'],
	}).notNull(),
	payload: text('payload', { mode: 'json' }).notNull(),
	status: text('status', {
		enum: ['pending', 'syncing', 'done', 'failed'],
	})
		.notNull()
		.default('pending'),
	attempts: integer('attempts').notNull().default(0),
	lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp_ms' }),
	failureReason: text('failure_reason'),
	// 用户真正执行操作的时间，入队时立刻记录，不是上传时的时间
	// 这是 LWW 冲突解决的基准时间戳，防止网络延迟重试时覆盖掉更新的操作
	operationAt: integer('operation_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
})
```

### 2. 仅改 4 个 Service 函数（最小侵入）

研究发现，所有业务逻辑（hook/facade/UI）最终都收敛到 `playlistService.ts` 中的 4 个函数入口。只改这 4 个，不动任何 hook 调用点：

```typescript
// playlistService.ts，在现有操作成功后追加队列写入（同一事务内）
async addManyTracksToLocalPlaylist(playlistId, trackIds, ...) {
  // 现有逻辑：INSERT INTO playlist_tracks ...

  // 新增：如果此歌单有 shareId 且角色是 owner/editor，入队
  if (await this.hasShareSync(playlistId)) {
    await this.enqueueSync(playlistId, 'add_tracks', { trackIds, ... })
  }
}

async batchRemoveTracksFromLocalPlaylist(playlistId, trackIds) { /* 同理 */ }
async reorderSingleLocalPlaylistTrack(playlistId, ...) { /* 同理 */ }
async updatePlaylistMetadata(playlistId, payload) { /* 同理 */ }
```

### 3. 新建 `PlaylistSyncWorker`（`lib/workers/PlaylistSyncWorker.ts`）

单例，负责消费队列：

```
触发时机：队列新增条目 | 网络恢复 | APP 前台 | 定时重试（失败项）

执行流程：
  1. 取出该歌单所有 pending/failed 条目（attempts < 3）
  2. 按 operationAt 排序（而非 createdAt），批量打包为一次 API 调用
     -- operationAt 在入队时立刻记录，代表真实操作时间
     -- 服务端依赖此字段做 LWW，顺序必须正确
  3. 调用 POST /api/playlists/:id/changes，每条变更携带 operation_at
  4. 成功 → status='done'，更新 playlists.lastShareSyncAt
     失败 → status='failed'，attempts++，failureReason 记录
```

### 4. 新建 API 客户端（`lib/api/sharedPlaylist.ts`）

封装上述 7 个端点的调用，注入 JWT token（存于 MMKV）。

### 5. 拉取同步（Pull）

```
定时/前台触发 → 对所有 shareRole != null 的歌单调用：
  GET /api/playlists/:id/changes?since=lastShareSyncAt
    → 应用 upsert/delete 到本地 playlist_tracks
    → 更新 lastShareSyncAt = server_time
```

### 6. 换设备恢复流程

```
用户登录 → 调用 GET /api/me/playlists
  → 遍历返回的歌单列表
  → INSERT INTO playlists (title, type='local', shareId, shareRole, lastShareSyncAt=0)
  → 对每个歌单触发全量拉取（since=0）
  → 本地歌单恢复完毕
```

### 7. UI 入口（最小改动）

- [apps/mobile/src/app/playlist/local/[id].tsx](apps/mobile/src/app/playlist/local/[id].tsx) 的 `FunctionalMenu` 中：
  - `shareRole=null` 时：新增「设为共享歌单」菜单项
  - `shareRole='owner'` 时：新增「分享链接」「查看同步状态（pending count/failed badge）」
  - `shareRole='subscriber'` 时：隐藏所有写操作按钮（排序、删除、添加）

---

## 三、执行步骤

**后端（`apps/backend`）**

1. 初始化 Hono + Drizzle + Cloudflare Workers 项目结构
2. 定义并 migrate 后端 PostgreSQL schema
3. 实现 JWT 中间件（B 站 cookie 验证 → 签发 JWT，payload 含 `mid`）
4. 实现 7 个端点的路由及业务逻辑

**前端**

1. 新增 DB migration：`playlists` 表加 3 字段 + 创建 `playlist_sync_queue` 表
2. 改 4 个 `playlistService.ts` 函数，添加入队逻辑
3. 实现 `PlaylistSyncWorker`（队列消费 + 自动重试）
4. 实现 `lib/api/sharedPlaylist.ts`（API 客户端）
5. 实现换设备恢复逻辑（登录后触发 `GET /api/me/playlists`）
6. UI 入口：`FunctionalMenu` 新增共享相关选项 + 同步状态指示
