# Xinzi 薪资计时器

Xinzi 是一款常驻 macOS 菜单栏的薪资计时器。它会根据你的工作时间、午休时间、月薪、入职日期和节假日安排，实时计算“今日已赚”“距离下班还剩多久”，也可以用一点坏笑记录“摸鱼薪资”。

## 下载

最新版 macOS 应用下载：

[下载 Xinzi.app.zip](https://github.com/jiajialinlin1/xinzi-/releases/download/v0.2.2/Xinzi.app.zip)

如果 macOS 提示“无法验证开发者”，请在 Finder 中右键点击应用，选择“打开”。当前版本未进行 Apple Developer ID 签名。

## 主要功能

- 常驻 macOS 菜单栏，工作中实时显示今日已赚金额
- 鼠标移入菜单栏显示快速窗口，查看今日已赚、已工作时间、距离下班剩余时间
- 午休时间自动暂停薪资增长，并显示“午休中”
- 非工作时间、周末、节假日显示“不要工作了”
- 支持每日工作时间、午休时间、每月工作日数、工资历史、入职日期设置
- 使用 publicHoliday 节假日 API 自动识别中国法定节假日与调休补班
- API 不可用时优先使用本地缓存，再回退到普通周末规则
- 支持手动设置休息日覆盖和补班日覆盖，适配公司特殊安排
- 摸鱼薪资：记录摸鱼时间、摸鱼薪资、今日摸鱼明细和自定义评价
- 支持隐藏敏感金额和天数字段，适合截图分享
- 本地保存设置和状态数据，不需要账号登录

## 节假日规则

节假日判断优先级：

1. 手动补班日覆盖
2. 手动休息日覆盖
3. publicHoliday API 或本地缓存
4. 普通周末规则

publicHoliday 数据来源项目：
[zy-mayong/publicHoliday](https://gitcode.com/zy-mayong/publicHoliday)

## 本地数据

应用数据保存在 Electron `userData` 目录中，包括：

- `settings.json`：工作时间、工资历史、入职日期、手动节假日覆盖
- `fish-state.json`：今日摸鱼记录和摸鱼状态
- `ui-state.json`：金额隐藏等界面偏好
- `public-holiday-cache.json`：节假日 API 缓存

## 开发

```bash
npm install
npm test
npm run dev:desktop
```

## 构建

```bash
npm run build:mac
```

构建产物位于：

```text
dist/mac-arm64/Xinzi.app
```

## 当前限制

- 当前发布包为 Apple Silicon / arm64 macOS 版本
- 未签名，首次打开需要手动允许
- Android、iOS、watchOS 版本尚未实现
