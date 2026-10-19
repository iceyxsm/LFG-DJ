# ANTI-SLOP-CHECK — LyricComposition

按 `$review-against-ai-patterns` 路由。本产物是全屏 kinetic-type 歌词叠层。

## G 灰色小字 · 高风险 → 未命中
- 规则复核：上下文行/ambient 一律用 `palette.primary`（亮冷色，非中性灰），
  透明度衰减表达纵深；upcoming 行 ≥2.1vh、exiting 行 3.4vh、plain 行 2.3vh。
- 复核：`proof/sync-mid.png` `sync-enter.png`——下一行呈 primary 色调半透明，
  不读作"灰字幕"；无 14px 以下的辅助说明文字。

## W 模板文案 · 中风险 → 未命中
- ambient(none/loading/instrumental) 只渲染 '♪' 符号与呼吸点，无任何提示句。

## O 双语眉题 · 中风险 → 未命中
- 全层无 eyebrow、无 chip、无标签；层级只由字号/字重/透明度/位置承担。

## D 插画画风/假质感 · 中风险 → 未命中
- 零位图、零装饰容器、零 CSS 渐变面板；唯一"光"是 accent `text-shadow`，
  承担"该词正在被唱"的进度职责，不是装饰。背景留给 WebGL canvas。

## P 配色模板 · 中风险 → 未命中
- 所有颜色 `rgbCss(palette.*)` 来自 mood；mood=null 时用 FALLBACK 兜底，仍非品牌模板色。

## 全局扫描
- 看过：proof/{sync-mid,sync-enter,sync-early,paused,long-line,plain,loading,instr,none}.png
- 新命中：无
