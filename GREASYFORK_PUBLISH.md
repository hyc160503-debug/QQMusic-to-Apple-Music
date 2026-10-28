# Greasy Fork 发布资料（维护者用）

> 当前状态：**发布者已提供 Greasy Fork 脚本地址**：[脚本 #602590](https://greasyfork.org/zh-CN/scripts/602590-qq-我喜欢-apple-music-本地迁移助手)。该页面的公开访问、版本和自动同步配置尚未独立核实。

## 推荐发布方式：从 GitHub 导入并同步

1. 使用自己的 Greasy Fork 账号登录：<https://greasyfork.org/zh-CN/>。可使用其支持的外部登录方式（如 GitHub）。
2. 打开「从其他网站导入脚本」（Greasy Fork 的导入功能），或进入个人用户页面选择「发布新脚本」。
3. 使用本项目的 **Raw 源码链接**：  
   `https://raw.githubusercontent.com/hyc160503-debug/QQMusic-to-Apple-Music/main/QQMusic-to-AppleMusic.user.js`
4. 如果出现自动同步设置，选择从上述 GitHub 主分支地址 **自动同步**。注意：源码本体须完整保存在 Greasy Fork，不能只发布一个远程加载器。
5. 核对脚本类型为 **用户脚本**，语言为 **简体中文**，可见性先选 **公开**（若需先试用，可选择未公开）。
6. 发布前检查：`@version` 为 `1.1.0-beta.2`，`@license` 为 `PolyForm-Noncommercial-1.0.0`，适用站点为 `y.qq.com` 与 `music.apple.com`。
7. 作者报告已完成首次发布，链接已加入 README。仍需在 Greasy Fork 后台核对版本与自动同步状态。

## 脚本名称

QQ 音乐「我喜欢」转 Apple Music｜免费迁移助手（Beta）

## 简短描述

在 QQ 音乐网页版备份「我喜欢」，在 Apple Music 网页版自动搜索匹配、恢复报告、批量审核，再由用户确认创建播放列表。非官方、无需第三方迁移订阅。

## 详细描述（可放到 Greasy Fork）

### 功能
- 从 QQ 音乐网页版备份喜欢的歌曲到 JSON/CSV。
- 在 Apple Music 网页版匹配歌曲，可手动核对相似版本。
- 支持加载已有匹配报告，不需要重复搜索。
- 可按指定最低相似度批量批准最高分候选。
- 需要用户确认才会创建新的 Apple Music 普通播放列表。

### 安装与使用
1. 安装 Chrome 的 Tampermonkey 扩展并启用用户脚本。
2. 从 Greasy Fork 页面安装此脚本。
3. 登录 <https://y.qq.com/>，通过右下角「♫ QQ → Apple」备份「我喜欢」。
4. 登录 <https://music.apple.com/>，上传 JSON、选择正确地区、匹配曲目。
5. 保存匹配报告；检查或批量选择候选；确认后创建歌单。

### 重要限制
- **非官方 Beta**：不隶属于腾讯、QQ 音乐或 Apple。
- QQ 音乐接口和 MusicKit 可能变更；功能可能随平台更新失效。
- 歌曲匹配有误差；低分候选可能是完全不同的歌曲。
- 仅迁移歌单元数据，不传输音频，也不将歌曲自动标为 Apple Music「喜爱」。
- 不要公开个人备份、Cookie、账号令牌或匹配报告。
- 此脚本不要求用户将密码提供给开发者。使用时仍会与 QQ 音乐及 Apple Music 的服务器通信。
- 创建成功后须在 Apple Music 里确认实际保存的歌曲数量。

### 许可与商业使用
**PolyForm Noncommercial License 1.0.0。** 允许符合该许可证的非商业用途；其他商业用途须事先取得版权所有者书面许可。许可费、收入分成比例、支付和结算条件须另行签订商业协议。详情见 <https://github.com/hyc160503-debug/QQMusic-to-Apple-Music/blob/main/LICENSE>。

**源代码 / 报错反馈：** <https://github.com/hyc160503-debug/QQMusic-to-Apple-Music>

## 发布核对
- [ ] 确认 Greasy Fork 登录的是项目所有者账号。
- [ ] 检查自动同步来源为 `main` 分支的 Raw `.user.js`，不是提交 SHA 固定链接。
- [ ] 确认许可证为 PolyForm Noncommercial，不是 MIT。
- [ ] 确认 Greasy Fork 展示的是完整源码、不是远程加载器。
- [ ] 检查是否提示代码、权限或发布规则问题；有问题先修复，不要绕过审核。
- [x] 发布者提供了实际页面 URL，GitHub README 已更新（页面可访问性尚待确认）。
