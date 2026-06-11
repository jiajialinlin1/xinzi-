# Xinzi 薪资计时器

macOS 状态栏薪资计时器，使用 Electron 构建。

## Features

- 状态栏实时显示今日已赚 RMB
- 午休期间显示“午休中”，薪资暂停增长
- 非工作时间、周末、节假日显示“不要工作了”
- 鼠标移入状态栏图标显示 Liquid Glass 快速浮窗
- 独立桌面主窗口支持设置工作时间、午休、工资历史、入职时间、节假日和补班日
- 本地明文 JSON 保存设置到 Electron `userData/settings.json`

## Development

```bash
npm install
npm test
npm run dev:desktop
```

## Build

```bash
npm run build:mac
```

The macOS app bundle is generated in `dist/mac-arm64`.
