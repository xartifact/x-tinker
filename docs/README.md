# x-tinker

Self-healing pipeline: runtime error → auto fix → deploy.

x-tinker 是一个自愈流水线系统。当项目 A（如 x-llm-gateway）在运行时产生程序错误或 Bug，会自动上报到 x-tinker。x-tinker 根据对应的项目源码和错误日志、trace 等信息，通过 Coding Agent 修复代码，推送到 CI/CD 流水线，最终更新和部署程序。

## 产品定位

**核心理念**: 从"错误被记录"跨越到"错误被自动修复"

传统方案止步于诊断（Sentry 等错误跟踪系统），x-tinker 则实现完整的 **诊断 → 修复 → 验证 → 部署** 闭环。

## 架构总览

```
┌─────────────────────┐     POST /api/events      ┌─────────────────────────┐
│  项目 A              │ ──────────────────────────→ │  x-tinker server        │
│  (被监控的应用)       │    { error, trace,          │  (Hono + tRPC)          │
│                      │      sourceContext }        │                         │
│  ┌───────────────┐  │                             │  ┌───────────────────┐  │
│  │ @x-tinker/sdk  │──│  SDK 自动捕获异常           │  │  Pipeline          │  │
│  │ 捕获 + 上报     │  │  并上报到 x-tinker          │  │  1. 读源码          │  │
│  └───────────────┘  │                             │  │  2. 调 LLM Agent   │  │
└─────────────────────┘                             │  │  3. 生成补丁        │  │
                                                    │  │  4. 应用补丁        │  │
┌─────────────────────┐                             │  │  5. 验证修复        │  │
│  LLM Agent          │                             │  │  6. Commit & Push  │  │
│  (模型无关)          │←──────── 调用 ────────────│  7. 记录结果        │  │
│  OpenAI / Anthropic │                             │  └───────────────────┘  │
│  / 自定义            │                             │                         │
└─────────────────────┘                             │  ┌───────────────────┐  │
                                                    │  │  PGlite Database  │  │
┌─────────────────────┐                             │  │  事件 + 修复记录   │  │
│  配置面板 (Web UI)   │                             │  └───────────────────┘  │
│  tRPC → React       │                             └─────────────────────────┘
│  shadcn/ui          │
└─────────────────────┘
```

## 模块功能清单

### 1. `@x-tinker/shared` — 共享类型层

定义整个系统的核心数据契约。

| 类型/功能 | 说明 |
|---|---|
| `ErrorEvent` | 错误事件结构（错误类型、消息、stack trace、源码上下文） |
| `FixPatch` | 修复补丁结构（unified diff、文件列表、摘要） |
| `FixResult` | 修复结果（状态：pending/applied/verified/failed） |
| `GatewayConnection` | LLM Agent 连接配置（model、baseUrl、protocol、apiKey） |
| `AppConfig` | 完整应用配置 |
| `validateErrorEvent()` | 上报事件校验函数 |
| Config store | 配置文件读写（`.x-tinker/config.json`） |

### 2. `@x-tinker/core` — LLM Agent 核心

模型无关的 LLM 调用抽象层。

| 功能 | 说明 |
|---|---|
| `LLMClient` | 模型无关的聊天客户端，通过 Provider 注册表选择实现 |
| `LLMProvider` 接口 | Provider 抽象接口，支持任意模型接入 |
| `OpenAIProvider` | OpenAI 协议实现（chat/completions） |
| `AnthropicProvider` | Anthropic 协议实现（messages） |
| `MockProvider` | 模拟 Provider，无 API key 时用于测试 |
| `registerProvider()` | 动态注册自定义 Provider |
| `generatePatch()` | 修复补丁生成器：构建 prompt → 调用 LLM → 解析 diff |

### 3. `@x-tinker/sdk` — 错误上报 SDK

项目 A 集成的客户端 SDK，负责错误捕获和上报。

| 功能 | 说明 |
|---|---|
| `ErrorReporter` | 核心上报器：构建 ErrorEvent → HTTP POST 到 x-tinker server |
| `captureError()` | 单次错误捕获并上报 |
| `captureUnhandledErrors()` | 全局错误处理器（uncaughtException + unhandledRejection），支持 Node.js 和浏览器环境 |
| `createHonoErrorMiddleware()` | Hono 框架错误中间件适配器，在请求处理链中捕获错误 |
| 请求上下文注入 | 上报时携带 `request_path`, `request_method`, `request_id` 等元数据 |

### 4. `@x-tinker/db` — 数据库持久化

基于 PGlite + Drizzle ORM 的嵌入式数据库。

| 功能 | 说明 |
|---|---|
| 自动建表 | 首次启动自动创建 events + fixes 两张表 |
| `events` 表 | 存储上报的原始 ErrorEvent（含 jsonb raw_event） |
| `fixes` 表 | 存储修复结果（status、diff、files、commit_sha） |
| `createDb()` | PGlite 初始化，支持自定义数据目录 |
| PGlite 嵌入式 | 无需外部数据库，数据文件存储于本地目录 |

### 5. `apps/server` — x-tinker 服务端

核心服务端，接收错误事件并编排修复流水线。

| 功能 | 说明 |
|---|---|
| **事件接收 API** | `POST /api/events` — 接收错误上报，持久化后触发 Pipeline |
| **tRPC API** | 配置读写 + 事件/修复历史查询 |
| **修复流水线 (Pipeline)** | 7 步编排：读源码 → 调 LLM → 生成补丁 → 应用 → 验证 → Commit → 记录 |
| 源码读取 | 根据上报的 filePath 读取项目 A 的源码（带行号标注） |
| 补丁应用 | 解析 unified diff 并写入文件 |
| 修复验证 | 重新运行项目测试/启动命令验证修复是否有效 |
| 自动提交 | git commit + push 到特性分支 |
| 静态文件服务 | 生产模式下内嵌 UI 构建产物（SPA fallback） |
| 配置持久化 | 通过环境变量或 UI 保存 LLM/Repo/Server 配置到 `.x-tinker/config.json` |

#### Pipeline 步骤

```
Step 1: 验证 ErrorEvent 完整性
Step 2: 读取错误位置的源码（PROJECT_A_PATH）
Step 3: 调用 LLM Agent 生成 unified diff 补丁
  └─ 构建 prompt: error + stack trace + 源码上下文
  └─ 解析 LLM 输出为结构化 FixPatch
Step 4: 将补丁应用到项目 A 源码
Step 5: 运行验证命令（测试/启动）
Step 6: git commit + push 到 auto-fix/<event-id> 分支
Step 7: 将修复结果写入数据库
```

#### LLM 配置集成

x-tinker 支持两种方式配置 LLM：

1. **直接连接** — 配置 `protocol`（openai/anthropic）、`model`、`baseUrl`、`apiKey`，直接调用 LLM API
2. **通过 x-llm-gateway** — 将 `baseUrl` 指向 x-llm-gateway 的 endpoint，由 x-llm-gateway 做协议转换和路由

### 6. `apps/ui` — Web 配置面板

React + Vite + shadcn/ui + TanStack Router + tRPC 的前端应用。

| 功能 | 说明 |
|---|---|
| **LLM Agent 配置** | Model、Endpoint URL、Protocol（OpenAI/Anthropic）、API Key |
| **仓库配置** | 项目 A 源码路径、Git Remote、分支前缀 |
| **服务器配置** | 端口号 |
| **Fix History** | 事件列表 + 修复状态（pending/verified/failed），带时间线展示 |

### 7. `Dockerfile` + `docker-compose.yml` — 容器化部署

| 功能 | 说明 |
|---|---|
| 多阶段构建 | Builder 阶段编译 UI → Runner 阶段仅运行 |
| 数据持久化 | PGlite 数据文件挂载到命名卷 |
| 项目 A 源码挂载 | 只读挂载源码供 Pipeline 读取 |
| 健康检查 | `/health` endpoint 探活 |

## 数据流

```
1. 项目 A 运行时报错
    │
2. @x-tinker/sdk 捕获错误
    │  └─ captureUnhandledErrors() / Hono error middleware
    │  └─ 构建 ErrorEvent（含 stack trace + 源码上下文 + 请求元数据）
    │
3. POST /api/events
    │  └─ x-tinker server 验证并持久化到 PGlite
    │  └─ 异步触发 Fix Pipeline
    │
4. Fix Pipeline
    │  ├─ 读取项目 A 源码（PROJECT_A_PATH）
    │  ├─ 调用 LLM Agent（通过 @x-tinker/core）
    │  ├─ 生成 unified diff 补丁
    │  ├─ 应用到项目 A 源码
    │  ├─ 验证修复（运行测试/启动）
    │  └─ git commit + push
    │
5. 修复结果写入数据库
    │
6. 开发者通过 UI 查看修复历史和状态
```

## 集成方式

### 项目 A 集成 SDK

```ts
import { captureUnhandledErrors } from '@x-tinker/sdk';

captureUnhandledErrors({
  serverUrl: 'http://x-tinker:3200',
  projectId: 'my-app',
});
```

### Hono 应用中间件

```ts
import { createHonoErrorMiddleware } from '@x-tinker/sdk';

app.use('*', createHonoErrorMiddleware({
  serverUrl: 'http://x-tinker:3200',
  projectId: 'my-app',
}));
```

### 环境变量

```bash
# 必须
X_TINKER_URL=http://x-tinker:3200
X_TINKER_PROJECT_ID=x-llm-gateway
```

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Bun 1.x |
| 服务端框架 | Hono 4 |
| API 层 | tRPC 11 |
| 前端 | React 19 + Vite + TanStack Router |
| UI 组件 | shadcn/ui (Radix + Tailwind v4) |
| 图标 | lucide-react |
| 数据库 | PGlite (嵌入式 PostgreSQL) |
| ORM | Drizzle ORM |
| LLM 抽象 | 自定义 Provider 接口（OpenAI/Anthropic/Mock） |
| 容器化 | Docker + docker-compose |