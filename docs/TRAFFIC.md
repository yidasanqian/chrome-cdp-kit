# 引流手册（Traffic）

目标：让「装 chrome-cdp 的人」知道有一个已经修好上游 issue、还多了登录态搬运的分支。
漏斗只有三层，别把它想复杂：

```
上游 chrome-cdp-skill（3.2k★ 的既有注意力）
        │  ①  在 issue / PR 里给出「已修 + 可复现命令」
        ▼
chrome-cdp-kit 仓库（★ 与 skill 安装）
        │  ②  awesome list / GitHub topics / Release 页 / 社区帖
        ▼
实际使用者（`cdp auth sync` 的真实需求）
```

原则先写死，否则就是发广告：

- **先修再推。** 每次引流必须挂一个可复现的证据（`npm run check`、`cdp drag` 的一行输出、issue 编号）。
- **上游场地只给结论和一行链接。** 不在别人的 issue 里写长文推销；维护者反对的复杂度要主动交代。
- **不刷群、不互 star、不买量。** 一次性刷来的流量会在两周内归零，还会让 upstream 维护者把你当噪音源。

## 资产盘点：拿什么去换注意力

| 资产 | 上游没有 | 能打的渠道 |
|---|---|---|
| 上游 #40 已修（`--remote-allow-origins=*` + 可读错误） | 是 | #40 issue 评论、troubleshooting 关键词长尾 |
| 上游 #24 已修（`cdp drag`） | 是 | three.js / canvas 自动化人群、`threejs` 关键词 |
| 上游 #19 已修（`CDP_DAEMON_TCP=1`） | 是 | 企业沙箱 / 云 IDE / Claude Code on the web 用户 |
| `cdp auth sync`（登录态搬进独立 profile） | 是 | 最硬的需求，SEO 与社区帖的主力卖点 |
| 22 个测试 + Ubuntu/Windows CI | 是 | 说服企业用户「这个分支更可靠」 |
| 文档齐（UPSTREAM / AUTH-TRANSFER / TROUBLESHOOTING / ROADMAP） | 是 | 被搜索命中的长尾页 |

## 一等渠道：上游仓库（转化率最高，也最容易翻车）

上游 issue 的读者就是精准用户。做法是**回答**，不是**推广**：

1. 每个已修 issue 下面回一条，结构固定：现象复现 → 本分支怎么修 → 一行命令验证 → 链接。
2. 有代码改动价值的，提 PR。PR 描述里写「本分支已验证 / 期望上游合并的形态」，不要写「请 star 我的仓库」。
3. 维护者拒绝时（#19 已有先例：抱怨复杂度），回复只补「默认行为不变，opt-in 环境变量」，然后停手。

可直接用的三条 issue 回复与三份 PR 描述在 [traffic/launch-posts.md](traffic/launch-posts.md)，拆分好的 `--body-file` 文件在同目录（`issue-NN.body.md`、`pr-NN.body.md`）。

命令（**需要你确认后执行**，会公开发布）：

```bash
# 分支推到 fork，再向上游开 PR
git switch -c upstream/fix-40-allow-origins && git push -u origin upstream/fix-40-allow-origins
gh pr create --repo pasky/chrome-cdp-skill --head yidasanqian:upstream/fix-40-allow-origins \
  --title "Surface the --remote-allow-origins requirement and pass it when launching" \
  --body-file docs/traffic/pr-40.body.md

# issue 回复
gh issue comment 40 --repo pasky/chrome-cdp-skill --body-file docs/traffic/issue-40.body.md
```

注意：#40 pull 出来的「Helium 候选路径」PR 在上游还开着，动 `getWsUrl` 之前先 `gh pr list --repo pasky/chrome-cdp-skill` 避免撞车。

## 二等渠道：让搜索和目录站能自己找到你

| 动作 | 具体做法 | 一次性收益 |
|---|---|---|
| Claude Code plugin marketplace | `.claude-plugin/marketplace.json` 让 `/plugin marketplace add yidasanqian/chrome-cdp-kit` 生效；和 `anthropics/skills`、`obra/superpowers` 同一套 schema | Claude Code 用户的唯一入口 |
| skills CLI（skills.sh） | `npx skills add yidasanqian/chrome-cdp-kit --skill chrome-cdp`；skills.sh 会自动收录能发现的 skill | Codex、Cursor、OpenCode 等 80+ agent |
| pi registry | `pi install git:github.com/yidasanqian/chrome-cdp-kit@v1.3.0` | pi 用户 |
| GitHub topics | 仓库设置里加 `chrome-devtools-protocol`、`browser-automation`、`ai-agents`、`claude-code`、`skills`、`devtools` | topics 页与站内搜索 |
| awesome list | 见 [traffic/awesome-lists.md](traffic/awesome-lists.md)，一条一条 PR | 长期外链 |
| 包 README 首屏 | 第一屏就写「修好 #19 #24 #40」+ 一条 `cdp auth sync` 命令 | 决定 60% 的 star |

## 三等渠道：英文技术社区（一次性峰值）

| 渠道 | 形态 | 要点 |
|---|---|---|
| Hacker News | `Show HN: chrome-cdp-kit – drive your live Chrome, then hand its logins to a clean profile` | 周二至周四 UTC 14:00–16:00 发；首条评论补技术细节与限制，别只放链接 |
| Reddit r/ClaudeAI、r/LocalLLaMA | 「agent 怎么用你已登录的浏览器」的实操贴 | 先答问题，链接放末尾；纯链接帖会被删 |
| dev.to / Medium | 长文：`App-Bound Encryption` 为什么让 cookie 复制失效，以及绕过它的正路 | 长尾搜索，`chrome app-bound encryption cookie` 是高竞争低供给词 |
| X / Twitter | 3 条串：问题 → `cdp auth sync` 一段输出 → 仓库链接 | 配一段 20 秒终端录屏 |

文案在 [traffic/launch-posts.md](traffic/launch-posts.md)，直接改占位符即可。

## 四等渠道：中文社区（口碑与咨询来源）

| 渠道 | 形态 | 备注 |
|---|---|---|
| V2EX（程序员 / 分享创造） | 「把已登录的浏览器交给 agent，不用复制 profile」 | 附真实终端输出，标题不要带「神器」 |
| 掘金 | 教程向：从 0 到 `cdp auth sync` 成功的一次完整跑通 | 代码块要能直接粘 |
| 知乎 | 「如何让 AI 操作已登录的网页」问题下的回答 | 长回答，末尾放仓库 |
| 即刻 / 少数派 | 场景化短文：抢票、内网后台、需要登录的自动化 | 少数派稿费与审核周期长，先发即刻 |
| B 站 | 3 分钟屏幕录制 | 录 `cdp doctor` → `cdp auth sync` → 新窗口已登录 |

## 30 天节奏

| 周 | 动作 | 目的 |
|---|---|---|
| W1 | 三个修复进 `main`，打 `v1.3.0`，GitHub Release 与 pi 安装就位，README 首屏改写 | 有可指向的稳定版本 |
| W2 | 三个上游 issue 回复 + 三份 PR；awesome list 提 3 条 | 拿到精准外链 |
| W3 | Show HN + 两个 Reddit 帖 + X 串 | 峰值曝光 |
| W4 | 中文三连（V2EX、掘金、知乎），把前三周的真实提问整理成 TROUBLESHOOTING 条目 | 长尾沉淀 |

复盘只看四个数：仓库 `unique visitors / referrers`、star 增量、GitHub Release 页访问量、issue 里出现的真实使用场景。
referrers 里排第一的渠道，下一轮加倍；star 涨了但下载没涨，说明首屏没把「怎么装」写清。

## 不要做

- 在无关仓库/issue 里留链接（一次就够被举报）。
- 假 star、互 star 群、买 GitHub 流量。
- 把 `--remote-allow-origins=*` 说成「安全」；它是放大本地信任边界，文档里必须如实写。
- 承诺「零授权弹窗」。Chrome 的「允许远程调试」是安全边界，本项目只做减法，不做绕过。