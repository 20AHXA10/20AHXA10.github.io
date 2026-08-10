# 个人博客

这个仓库是基于 GitHub Pages 的个人博客，当前已增加一个可用的后台管理入口：`/admin/`。

## 1. 启用后台

1. 在 GitHub 上创建一个 Personal Access Token（PAT）
2. 选择 `repo` 权限
3. 访问 `https://20AHXA10.github.io/admin/`
4. 填入：GitHub Token、仓库所有者、仓库名称、分支、数据文件路径
5. 点击「连接仓库」

默认配置为：
- Owner：`20AHXA10`
- Repo：`20AHXA10.github.io`
- Branch：`main`
- Data Path：`data/posts.json`

## 2. 数据保存方式

后台会把文章列表保存在 GitHub 仓库中的 JSON 文件中，而不是只存在浏览器本地。这样可以更接近真实的内容管理后台体验。

## 3. 说明

由于 GitHub Pages 是静态站点，不支持直接部署 Node.js / PHP / Python 后端，所以这里采用的是“前端 + GitHub API”的真实后台工作流：

- 登录使用 GitHub Token
- 文章数据写入仓库文件
- 读取/保存/同步都通过 GitHub REST API 完成
- 适合小型博客或静态站点后台管理

如果你想进一步升级成真正的服务端后台，可以继续接入一个云函数 / VPS / Render / Vercel 等后端服务。
