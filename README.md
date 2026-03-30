# Aether UEFI 原型

created by codex.

这是一个纯前端静态原型项目，用 `HTML + CSS + JavaScript` 模拟以下几段体验：

- UEFI 固件界面
- WinRE 选择页与疑难解答页
- 伪 Windows 登录页
- 多段启动过场、黑屏、Logo、加载动画切换

它不是实际的固件工程，也不包含 EDK2、BIOS 构建链或系统级启动逻辑，目标是做交互展示和视觉还原。

## 运行方式

项目没有构建步骤，也不依赖 Node 包管理器。

直接打开根目录下的 [index.html](/C:/Users/尘柒/IdeaProjects/UEFI/index.html) 即可运行。

如果浏览器因为本地文件策略导致部分资源行为异常，可以用任意静态服务器启动，例如：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 主要内容

- WinRE 主页面
  - `继续`
  - `使用设备`
  - `疑难解答`
  - `重启电脑`
- 疑难解答页面
  - 启动设置
  - 命令提示符
  - UEFI 固件设置
  - 系统映像恢复
- UEFI 页面
  - 设备信息
  - 安全
  - 启动项
  - 日期与时间
  - 关于
  - 退出
- 伪 Windows 登录页
  - 背景图
  - 时间 / 日期
  - 头像
  - 用户名
  - 登录页提示与“立即重新启动”按钮

## 目录结构

```text
.
├─ index.html
├─ img/
└─ assets/
   ├─ styles/
   │  └─ app.css
   └─ scripts/
      ├─ app.js
      ├─ core/
      │  ├─ dom.js
      │  ├─ state.js
      │  └─ storage.js
      └─ features/
         ├─ date-time.js
         └─ startup-flow.js
```

## 脚本说明

- [app.js](/C:/Users/尘柒/IdeaProjects/UEFI/assets/scripts/app.js)
  - 主入口
  - 负责状态、事件绑定、页面流转和登录页行为
- [dom.js](/C:/Users/尘柒/IdeaProjects/UEFI/assets/scripts/core/dom.js)
  - 统一收集 DOM 引用
- [state.js](/C:/Users/尘柒/IdeaProjects/UEFI/assets/scripts/core/state.js)
  - 默认状态、存储键、安全启动文案
- [storage.js](/C:/Users/尘柒/IdeaProjects/UEFI/assets/scripts/core/storage.js)
  - `localStorage` 读写封装
- [startup-flow.js](/C:/Users/尘柒/IdeaProjects/UEFI/assets/scripts/features/startup-flow.js)
  - WinRE / 认证页 / 过场动画切换
- [date-time.js](/C:/Users/尘柒/IdeaProjects/UEFI/assets/scripts/features/date-time.js)
  - 日期时间字符串解析和格式化

## 当前交互约定

- `Insert`
  - 清空本地状态并刷新页面
- `Backspace`
  - 在 WinRE 子页面返回上一页
- `Delete`
  - 在两个启动 Logo 画面里，如果 `请稍后` 或加载动画尚未出现，可直接跳转到 UEFI

## 存储行为

项目会把部分状态保存在浏览器 `localStorage` 中，例如：

- UEFI 开关状态
- 安全启动配置
- 启动项顺序 / 勾选 / 删除状态
- 日期时间偏移
- UEFI 密码

如果想恢复默认状态，可以直接按 `Insert`。

## 注意事项

- 这是前端原型，不是可启动系统。
- 所有“重启”“进入固件”“恢复系统”等行为都是界面模拟。
- 项目目前没有自动化测试，改动后建议手动验证：
  - WinRE 页面切换
  - UEFI 页面交互
  - 登录页动画
  - 快捷键行为

## TODO

- BitLocker 恢复页
