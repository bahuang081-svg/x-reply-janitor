# X Reply Janitor

一个本地运行的浏览器扩展，用来折叠 X/Twitter 回复区里高相似度、引流式的机器人评论。

它不调用 X API，不需要账号授权，也不会把页面内容发到服务器。扩展只在浏览器里读取当前页面 DOM，用规则评分判断一条回复是否像机器人 spam。

## 能挡什么

- 短句加 `@某人` 的引流回复
- “点我头像 / 主页能打 / 联系人 / 靠谱对接”等固定话术
- 成人/擦边/外部联系方式导流
- 随机用户名、带数字后缀、重复模板等弱信号
- 同一页面里重复出现的复制文案

默认只在帖子详情页过滤回复区，避免影响首页阅读。你可以在弹窗里开启“在首页/搜索也过滤”。

## 安装

### Chrome / Edge

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 打开“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库目录。

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“临时载入附加组件”。
3. 选择 `manifest.json`。

## 使用

- 扩展安装后打开 `x.com` 或 `twitter.com`。
- 进入任意帖子详情页，机器人回复会被折叠。
- 点击扩展图标可以切换强度、隐藏方式、重新扫描或恢复本页。
- 在“规则”页面可以添加白名单和自定义关键词/正则。

## 自定义规则

每行一个关键词，或写成 JavaScript 正则：

```text
点我头像
/刷了半天.*主页/i
/@[a-z0-9_]{8,}\s*$/i
```

白名单每行一个账号，带不带 `@` 都可以。

## 打包

在 PowerShell 里运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\validate-extension.ps1
powershell -ExecutionPolicy Bypass -File .\tools\package.ps1
```

压缩包会生成到 `dist/x-reply-janitor.zip`。

## 隐私

见 [PRIVACY.md](PRIVACY.md)。简短版：没有远程请求，没有遥测，没有账号凭据。

## 限制

这是规则过滤器，不是魔法。它会尽量挡住截图里那类机器人回复，但不能保证 100% 命中。遇到漏网模板时，把关键词加到自定义规则，或提交 issue/PR。

## License

MIT
