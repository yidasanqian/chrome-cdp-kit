# Awesome-list 投放清单

只投**人工维护、审核真的看内容**的列表。每条 PR 都必须回答「为什么这个东西值得放在这里」，
一句话，不要形容词堆砌。

存在性用这条命令核对（不要把没核对的仓库名写进 PR）：

```bash
gh api repos/<owner>/<repo> -q '.full_name + " " + (.stargazers_count|tostring)'
```

| 列表 | 星数 | 相关子章节 | 条目一句话 |
|---|---|---|---|
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 58k | Skills / tooling | `chrome-cdp` skill + `cdp auth sync`：把已登录浏览器交给新 profile |
| [sindresorhus/awesome-nodejs](https://github.com/sindresorhus/awesome-nodejs) | 68k | Command-line utilities / Browser | 零依赖 CDP CLI，Node 22 内置 WebSocket |
| [e2b-dev/awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents) | 31k | Tools & frameworks | agent 的浏览器会话交接 |
| [lorien/awesome-web-scraping](https://github.com/lorien/awesome-web-scraping) | 8k | Browser automation | 操作真实已登录浏览器，非 headless 复刻 |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | 41k | Instructions / Skills | skill 形态的 CDP 工具集 |

星数为核对时的快照，PR 正文里不要写数字。

## 条目写法（英文列表）

```markdown
- [chrome-cdp-kit](https://github.com/yidasanqian/chrome-cdp-kit) - Zero-dependency CLI and agent skill for the Chrome DevTools Protocol: drive the live browser, then transfer cookies and `localStorage` into an independent profile. Fixes upstream `chrome-cdp-skill` issues #19, #24 and #40.
```

`awesome-nodejs` 只接受「库/工具」这一类，提交时用这条：

```markdown
- [chrome-cdp-kit](https://github.com/yidasanqian/chrome-cdp-kit) - CLI for the Chrome DevTools Protocol over raw WebSocket (Node 22+ built-in, no Puppeteer): tab listing, screenshots, canvas drag, cookie transfer between browser profiles.
```

## PR 模板

```markdown
## What

Adds one entry to `<section>`:

- [chrome-cdp-kit](https://github.com/yidasanqian/chrome-cdp-kit) - <一句话>

## Why it belongs

- It is not a duplicate of `chrome-cdp-skill` in the same list (if both are listed, the entry makes the
  difference explicit: login-state transfer + three fixed upstream issues).
- Zero runtime dependencies, Node 22+, MIT, 22 tests, Ubuntu + Windows CI.
- Actively maintained: <最近一次提交日期 / 当前版本号>.

Happy to adjust wording or drop it if it does not fit the section.
```

## 顺序

1. `awesome-claude-code`（受众最贴合 skill 形态，审核最快）。
2. `awesome-web-scraping`（浏览器自动化章节，精准）。
3. `e2b-dev/awesome-ai-agents`（agent 基建，受众广但审核慢）。
4. `awesome-nodejs`（要求最严，等 v1.3.0 在 npm 上有稳定版本再提）。
5. `awesome-copilot`（要 skill/instruction 形态，确认目录结构后再说）。

每投一条，等 2 周无回应再投下一条；被拒就在 PR 里问「缺什么」，不要换号重投。

## 不要做

- 同一列表里同时出现 `chrome-cdp-skill` 和本项目却不说清关系 —— 会被当重复条目拒掉。
- 提交时顺手改别的条目、调格式、改排序。
- 用 `[x]` 勾一堆自己没做过的 checklist。