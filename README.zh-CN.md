# chrome-cdp-kit

[English](README.md) · **简体中文**

[![CI](https://github.com/yidasanqian/chrome-cdp-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/yidasanqian/chrome-cdp-kit/actions/workflows/ci.yml)
[![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-3c873a)](https://nodejs.org)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

面向 agent 与人类的 Chrome DevTools Protocol 工具集：

- 操作**你正在用的浏览器**——已开的标签页、已登录的会话、当前页面状态；
- 把这份**登录态**交给一个**全新的独立浏览器 profile**——不用关掉原浏览器，也不用复制 profile 目录。

基于 [chrome-cdp-skill](https://github.com/pasky/chrome-cdp-skill) **v1.1.0**（`ffea76a2`，MIT）。上游代码保持原样，新增功能全部在 `skills/chrome-cdp/scripts/kit/`；上游命令、参数与脚本调用方式完全兼容。

## 与原版对比


| | [chrome-cdp-skill](https://github.com/pasky/chrome-cdp-skill) | chrome-cdp-kit（本项目） |
|---|---|---|
| 操作正在用的浏览器 / 已开标签页 | 是 | 是，命令与参数不变 |
| 每标签页 daemon、20 分钟空闲 | 是 | 是（未改动） |
| 登录态搬运（cookie + `localStorage`） | — | `cdp auth export / import / sync` |
| 启动独立 profile | — | `cdp launch --profile DIR` |
| 诊断 | — | `cdp doctor` |
| 自动化测试 | 无 | 22 个（`node --test`） |
| CI | 无 | GitHub Actions，Ubuntu + Windows |
| 文档 | README + SKILL | 另加上游策略、登录态搬运设计、路线图、变更日志 |
| 运行时依赖 | 无，Node 22+ | 相同 |
| 授权模型 | 每标签页一次（daemon） | 上游命令不变；新命令每浏览器每次运行一条连接 |
| 许可证 | MIT | MIT，保留上游版权声明 |

对上游命令没有破坏性改动：`list`、`snap`、`eval`、`shot`、`html`、`nav`、`net`、`click`、`clickxy`、`type`、`loadall`、`evalraw`、`open`、`stop`。

## 本项目增加了什么

| 新增 | 价值 |
|---|---|
| `cdp auth export/import/sync` | 把 cookie 与 `localStorage` 从现有浏览器搬进另一个 profile。源浏览器自己解密 cookie，App-Bound Encryption 不再是障碍。 |
| `cdp launch --profile DIR` | 在专用 profile 上分离启动独立浏览器，自带调试端口。 |
| `cdp doctor` | 列出可见的浏览器与 `DevToolsActivePort`，不输出密钥。 |
| 测试与 CI | 用 `node --test` 与 GitHub Actions 固定行为。 |
| 维护文档 | 上游基线、两处扩展点、发布流程与路线图。 |

## 安装

**Claude Code——plugin marketplace**（agent skill 的标准路径）：

```bash
/plugin marketplace add yidasanqian/chrome-cdp-kit
/plugin install chrome-cdp@chrome-cdp-kit
```

**skills CLI 支持的其他 agent**（Codex、Cursor、OpenCode、Copilot 等）：

```bash
npx skills add yidasanqian/chrome-cdp-kit --skill chrome-cdp
```

加 `-g` 装到所有项目（默认只装当前项目），加 `-a <agent>` 指定 agent。

**pi：**

```bash
pi install git:github.com/yidasanqian/chrome-cdp-kit@v1.3.0
```

两条主路径都是原样安装 `skills/chrome-cdp/`：没有构建步骤、不需要 `npm install`、不写全局状态。如果装过原版 `chrome-cdp` skill，先移除：两者同名。

### 卸载

```bash
/plugin uninstall chrome-cdp@chrome-cdp-kit
/plugin marketplace remove chrome-cdp-kit

npx skills remove chrome-cdp
```

没有别的残留：不注册自启动、不写全局配置、不改 PATH。正在运行的每标签页 daemon 空闲 20 分钟后自行退出，`cdp stop` 可立即结束。用 pi 装的，用 pi 自己的包管理命令移除。

### 只用 CLI

仓库自带 `cdp` 命令；装好 skill 之后，同一个文件就在 `skills/chrome-cdp/scripts/cdp.mjs`。想把它放进 PATH，没有构建步骤：

```bash
git clone https://github.com/yidasanqian/chrome-cdp-kit
cd chrome-cdp-kit
npm link            # 可选：把 cdp 放进 PATH
cdp doctor
```

不发 npm 包，原因写在 [docs/UPSTREAM.md](docs/UPSTREAM.md#release)。


## 打开一次远程调试

Chrome：`chrome://inspect/#remote-debugging` 打开开关。
Edge：`edge://inspect` 里的远程调试开关（版本提供时）。

如果浏览器把 `DevToolsActivePort` 写在非标准位置，用 `CDP_PORT_FILE` 指向完整路径。

**Chromium 128+** 的 WebSocket 有 Origin 白名单，上面那个开关不会填它。自己启动的浏览器要在命令行加 `--remote-allow-origins=*`（或某一个具体 origin）；`cdp launch` / `cdp auth sync` 启动的浏览器已自带该参数。CLI 现在会直接点明这个原因，不再只吐一句握手错误，见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

**沙箱环境**（容器、云 IDE）禁止 `AF_UNIX` `bind()` 时会报 `listen EPERM`：设 `CDP_DAEMON_TCP=1`，每标签页 daemon 改走 loopback 端口。


## 上游命令

```bash
cdp list                              # 已开标签页 + 唯一 target 前缀
cdp snap   <target>                   # 可访问性树
cdp eval   <target> "expression"
cdp shot   <target> [file]            # 视口截图 + DPR/坐标换算提示
cdp html   <target> [selector]
cdp nav    <target> https://...
cdp net    <target>
cdp click  <target> "selector"
cdp clickxy <target> <x> <y>
cdp drag   <target> <x1> <y1> <x2> <y2> [steps]   # 按下 → 移动 → 松开（canvas 拖拽）
cdp type   <target> "text"
cdp loadall <target> "selector" [ms]
cdp evalraw <target> <method> [json]
cdp open   [url]                      # 新标签页 → 新的「允许」弹窗
cdp stop   [target]
```

## 新增命令

```bash
# 看当前可见的浏览器与调试端口，不输出密钥
cdp doctor

# 从现有浏览器读（一条 CDP 连接，一次「允许」）
cdp auth export --out auth.json --origin https://github.com --origin https://app.example.com

# 写进一个正在运行的浏览器
cdp auth import --auth auth.json --port-file "$TEMP/target-profile/DevToolsActivePort"

# 或者一条命令完成读取、启动、写入，全程内存
cdp auth sync --browser edge --profile "$TEMP/cdp-profile" \
  --origin https://github.com --url https://github.com

# 启动独立浏览器并可选导入
cdp launch --browser edge --profile "$TEMP/cdp-profile" --auth auth.json --url https://github.com
```

`launch` / `sync` 之后，把 `CDP_PORT_FILE=<profile>/DevToolsActivePort` 交给任意 CDP 客户端即可操作新实例；新浏览器分离启动，CLI 退出后继续运行。

| 选项 | 适用 | 含义 |
|---|---|---|
| `--out FILE` | `auth export` | 必填；明文凭证，POSIX 下以 `0600` 写入 |
| `--auth FILE` | `auth import`、`launch` | 要写入的载荷 |
| `--origin URL` | `auth export/sync`、`launch`、`import` | 额外搬运该 origin 的 `localStorage`（可重复） |
| `--domain DOMAIN` | `auth export/sync` | 只搬该域名 cookie（可重复，后缀匹配） |
| `--port-file FILE` | export/import | 指定 `DevToolsActivePort`，不走自动探测 |
| `--source-profile DIR` | export/sync | 用 `DIR/DevToolsActivePort` 作为源 |
| `--profile DIR` | launch/sync/import | 目标 profile（必须是专用目录，绝不能用日常 profile） |
| `--browser NAME` | launch/sync | `chrome`、`edge`、`chromium`、`brave`、`vivaldi` 或绝对路径 |
| `--url URL` | launch/sync | 启动打开的页面，默认 `about:blank` |
| `--headless` | launch/sync | 无头启动 |
| `--close-after-import` | launch/sync | 导入完成后关闭新浏览器 |
| `--json` | 新命令 | 机器可读摘要 |
| `--timeout MS` | 新命令 | 连接/导航超时，默认 15000 |

源探测取**修改时间最新**的默认 profile `DevToolsActivePort`；同时跑多个浏览器时请显式传 `--port-file`。

## 授权、daemon 与无法避免的部分

Chrome/Edge 在一条新的 CDP 连接附加到**有数据的 profile** 时会问「允许远程调试？」。这是安全边界，不是 bug：

- 全新 profile 没有数据也没有登录态；带登录态的 profile 一定会问；
- 上游页面命令是**每标签页一个 daemon**：每个 tab 授权一次，之后 20 分钟空闲内复用；
- 新增的 auth 命令是**每个浏览器每次运行一条浏览器级连接**：一次 `sync` 最多两次弹窗（源 + 新实例）。

没有任何工具能同时做到「独立实例 + 实时登录态 + 零授权」。本项目把取舍写清楚，而不是绕过去。

## 安全

`auth.json` 是明文凭证。优先用 `auth sync`（只走内存）；导出的文件用完删除；不要提交、不要贴进 issue；`--profile` 用临时目录，任务结束就删。见 [SECURITY.md](SECURITY.md)。

## 维护

- 上游基线与同步流程：[docs/UPSTREAM.md](docs/UPSTREAM.md)
- 登录态搬运的设计与协议调用：[docs/AUTH-TRANSFER.md](docs/AUTH-TRANSFER.md)
- 故障排查：[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- 引流手册与文案：[docs/TRAFFIC.md](docs/TRAFFIC.md)
- 发布：打 tag 即由 CI 生成 GitHub Release，见 [docs/UPSTREAM.md](docs/UPSTREAM.md)
- 计划：[docs/ROADMAP.md](docs/ROADMAP.md)
- 变更：[CHANGELOG.md](CHANGELOG.md)

```bash
npm test        # 22 个测试，无依赖
npm run check   # 语法 + 测试
```

## 许可证与署名

MIT。上游代码 Copyright (c) 2026 pasky；新增部分 Copyright (c) 2026 yidasanqian。见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。