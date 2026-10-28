# QQMusic to Apple Music

基于 Tampermonkey 的 QQ 音乐「我喜欢」→ Apple Music 迁移工具（测试版）。

> 非官方项目，与腾讯、QQ 音乐及 Apple 无隶属关系。脚本使用网页接口，可能随平台更新失效。歌曲匹配结果须自行确认。

## 功能

- 导出 QQ 音乐「我喜欢」歌曲清单（JSON / CSV）
- 使用 Apple Music 曲库按歌名、歌手等信息匹配
- 生成、恢复匹配报告，支持按相似度批量选择候选
- 经用户确认后创建 Apple Music **普通歌单**（不自动标记为「喜爱」）

## 使用方法

1. 使用 Chrome 安装 [Tampermonkey](https://www.tampermonkey.net/) 并开启用户脚本权限。
2. 点击 [安装 QQMusic-to-AppleMusic.user.js](https://raw.githubusercontent.com/hyc160503-debug/QQMusic-to-Apple-Music/main/QQMusic-to-AppleMusic.user.js)，在 Tampermonkey 中确认安装；若只显示代码，可保存为 `.user.js` 后从 Tampermonkey 管理面板导入。**如果曾安装旧版脚本，请先停用旧版，避免重复出现按钮。**
3. 访问 [QQ 音乐网页版](https://y.qq.com/)，登录后通过「♫ QQ → Apple」导出「我喜欢」JSON。
4. 访问 [Apple Music 网页版](https://music.apple.com/)，登录并导入该 JSON，设置正确的地区代码（如 `cn`、`sg`、`us`）。
5. 匹配歌曲，保存匹配报告并检查结果；确认后创建歌单。
6. 在 Apple Music 中核对真正保存的歌曲数量和版本，注意相似度低的匹配可能是错误歌曲。

## 许可证与商业授权

**本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)，不是 MIT 许可证，也不属于允许商业使用的开放源码许可证。**

- 个人学习、研究、娱乐等符合许可证定义的**非商业用途**，可免费使用、修改和分享，须遵守完整许可证条款。
- **未经版权所有者事先书面授权，不得将本软件及其受保护的衍生代码用于超出该许可证允许范围的商业用途**，例如收费软件、收费迁移服务或商业产品集成。
- 需要商业使用的企业或个人，必须与版权所有者**另行签署商业许可协议**。许可费、收益分成比例、收入计算方式、支付和结算周期等，均须在协议中明确约定。**公开许可证不会自动授予商业使用权，也不会自动产生分成义务。**
- 商业授权咨询：通过本仓库的 [GitHub Issues](https://github.com/hyc160503-debug/QQMusic-to-Apple-Music/issues) 联系维护者；不要公开任何账号凭证。
- 受法律允许的合理使用及许可证明示允许的机构用途，不受本 README 扩张限制。完整法律条款以 [LICENSE](LICENSE) 为准。

Copyright © 2026 hyc160503-debug. All rights reserved except as expressly licensed.

## 隐私与使用风险

- 脚本在本机浏览器里使用当前 QQ 音乐登录信息访问 QQ 音乐接口，在 Apple Music 网页上调用 MusicKit；不要求把密码发给项目作者。
- 导出的 JSON、匹配报告属于个人资料，**不要上传到公开 GitHub 仓库、Issues 或 Pull Requests**；也不要公开 Cookie、Token。
- 只传输歌单元数据，不转移音频文件、DRM 内容或音乐版权。
- 匹配结果不保证准确；不同国家/地区可能缺曲或版本不同。
- 如果接口返回「已提交」，也要检查 Apple Music 实际写入情况，避免重复创建歌单。

详见 [安全说明](SECURITY.md) 与 [更新日志](CHANGELOG.md)。
