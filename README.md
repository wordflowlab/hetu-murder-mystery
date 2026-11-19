# 河图剧本杀工坊

> 组织完整角色分幕正文、证据推导与机制轮次，固定版本测本、复盘并接续创作。

## 简介

剧本杀工坊是独立TypeScript／React河图插件。外部Agent通过河图稳定CLI/MCP发现并调用，作者在工作面阅读、比较、反馈；作品正文和正式决定由宿主管理。

## 快速上手

安装河图插件中心提供的固定运行包，再向当前Agent说明本次作品与目标。先发现当前安装版能力，再读取包内`hetu-murder-mystery`方法和已有工程。

读取固定原著与已有工程→完整案情与角色分幕正文→证据推导与机制→分角色审阅→固定测本与复盘→局部返工→新版复测或宿主候选。

## 开发

Node.js 25，固定依赖见`package-lock.json`。

```bash
npm ci
npm run build
npm run check
npm run test:unit
npm run test:machine
npm run test:ui
npm run package
```

机器与界面验收使用`acceptance-lock.json`固定的正式宿主；完整步骤见[开发与发布](docs/07-开发发布与维护.md)。

## 边界

本包是创作与线下试玩记录工具，不是线上游戏服务器或独立权限系统。玩家投影只返回选定角色可见资料；作者仍可使用主持视角。模拟试玩明确agent_simulated，不冒充真人反馈。发放只记录，不发送消息。正式人物、正文采纳和定稿归宿主；泄漏结构检查不判断文本自身是否暗示真相。

## 文档

[功能清单](CAPABILITIES.md) · [产品与开发文档](docs/README.md) · [验收记录](docs/08-实施计划与验收记录.md)。

固定运行包与发布状态见[插件中心](https://hetu.limeai.run/plugins/murder-mystery/)及[验收记录](docs/08-实施计划与验收记录.md)。
