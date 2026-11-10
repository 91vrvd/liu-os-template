# Liu OS 开源桌面网站模板

这是从 Liu OS 完整版桌面网站的当前代码整理出的**独立公开模板**。保留了桌面、窗口、Dock、内置应用、手机布局、中英文切换，以及可选的内容管理服务。作者的个人资料、项目经历、联系方式、媒体和私有配置没有包含在这里；它们只保存在原网站的私有源码中。本仓库从一份清理后的文件快照创建，没有继承私有仓库的提交历史。

## 快速开始

需要 Node.js 20 或更新版本。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。检查正式构建：

```bash
npm run build
npm run preview
```

## 写入你自己的内容

1. 编辑 `src/data/portfolioData.ts` 中的 `publicProfile`。项目、经历、技能数组默认为空；按文件顶部的类型定义填入自己的内容。
2. `src/content/siteContent.tsx` 把这些数据作为网站的默认内容。书签、歌曲和桌面快捷方式也从空数组开始。
3. 在 `index.html` 和 `sites-shell/app/layout.tsx` 修改网站标题与说明；需要更换品牌文字时搜索 `Liu OS`。
4. `public/favicon.svg` 是模板图标，可替换为自己的图标。若加入图片、音频、字体或地图，请确认自己有公开分发权。

本模板不预设作者账号或链接。填入的资料会随着网页一起公开，请只写愿意公开的信息。

## 部署

仓库附带 GitHub Pages Actions 工作流。Fork 后把 `.github/workflows/deploy-pages.yml` 中的 `VITE_BASE_PATH` 改为你的仓库路径（例如 `/my-site/`），在仓库设置中将 Pages 来源设为 **GitHub Actions**，推送到 `main` 即可。纯静态部署会使用上面的默认内容；登录、在线内容编辑和文件上传需要额外部署 `sites-shell` 服务。

`sites-shell/` 是可选的 Next.js 服务端，包含管理员登录、内容草稿与发布、媒体上传和共享功能。配置示例在 `sites-shell/.env.example`；请在自己的部署环境设置变量，不要提交真实密钥。可先运行 `npm run build:sites` 验证服务端构建。

`cloudbase-mirror/` 是另一种可选的镜像服务端源码，默认上游为 `https://example.com`；部署前需按自己的站点配置上游。构建产物与真实部署配置不在仓库里。

## 授权与素材

代码按仓库中的 [MIT License](LICENSE) 开源，并保留上游原作者的版权声明。地图纹理由 Solar System Scope / INOVE 提供，采用 CC BY 4.0，来源及署名见 `public/maps/credits.txt`。其他第三方服务和商标仍归各自权利人所有。

---

**English:** This is a clean, reusable snapshot of the full Liu OS desktop website code. Personal profile, projects, contact details, private configuration, and private Git history are not included. Edit `src/data/portfolioData.ts`, run `npm ci && npm run dev`, and set your own `VITE_BASE_PATH` before deploying to GitHub Pages. The optional `sites-shell` backend requires your own credentials and hosting.
