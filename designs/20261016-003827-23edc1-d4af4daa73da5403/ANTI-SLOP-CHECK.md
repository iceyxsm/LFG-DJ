# ANTI-SLOP-CHECK — LFG-DJ `src/visuals/` engine

Visual deliverable = a fullscreen generative-AV canvas (WebGL2). No DOM chrome,
no cards, no marketing copy. Routed risk groups below; only those that can
actually manifest in a shader/particle/text-canvas surface are tracked.

## P 配色模板 · 高风险
- 位置：`src/visuals/engine.ts` 背景场 + 粒子场 + 歌词文字，整幅。
- 症状：生成式 AV 最常见的失败是"一切都是默认蓝紫渐变"——固定色相、与曲目无关，看起来像任意 demo。
- 修改：`mood.ts` 已由 track 身份哈希出 anchorHue + counterHue + 暖向 accent（补色到分裂三色），`state.ts` 用专辑封面色做 35% hue 微调。engine 直接把 `palette.base/primary/counter` 送入 GLSL 场与粒子，不写死任何 hue。能量只做强度/尺寸乘子，不改色相——颜色永远来自 mood，不是来自"科技感"题材联想。
- 复核：见 `proof/` 帧——不同 track seed 产生不同色域；活跃行用 accent（暖）从冷场里跳出，不是又一层同色。

## D 插画画风 / 质感门槛 · 中风险
- 位置：整幅画面的生成式视觉。
- 症状：用 CSS 渐变/发光弧线/抽象几何手写"模拟"金属、玻璃、体积光那一档材质质感＝图鉴 D。
- 修改：本产物不声称任何照片级材质/光照 hero——视觉就是生成式流场本身（domain-warped fbm + curl 粒子 + bloom）。GLSL 噪声/辉光是该领域的真实媒介，不是对某个该用 image_generate 的照片资产的模拟。无位图、无假装 3D 渲染的 hero。专辑封面只取色不入画，避免贴图瀑布。
- 复核：proof 帧检查没有"假装的材质"——画面是诚实的生成噪声场，不是模拟照片。

## G 灰色小字 · 中风险
- 位置：歌词行、attract/plain 模式下的任何文字。
- 症状：歌词是主角不是 HUD；把它画成小灰字/描边提示就是 karaoke-box 降级，也是把层级问题藏进过浅过小文字。
- 修改：活跃行大字号居中、accent 着色、`linePulse` 触发 scale/glow 呼吸（`lyricPulse`）；过期行收缩+溶解进粒子场而不是退成小灰注脚。plain 模式只放一条克制的 marquee，不堆小号灰字。attract/none 不放任何字。
- 复核：proof 帧里活跃行可读尺度远高于画面噪声，是明确的视觉主角。

## 其它图鉴组（B/T/O/S/W/H/N/卡片套壳等）
- 本产物无 DOM UI、无眉题、无胶囊、无编号口诀、无模板文案、无占位卡片——这些组在该交付面上无可命中载体，按格式不空列。若最终帧出现把歌词当成"编号清单/胶囊堆"排版的迹象，会在终态全局扫描补记。

## 全局扫描
- 看过：`proof/` 全套帧 — synced-active / synced-late / plain / attract / none / paused /
  lyric-crop / glyph-check + 5 个种子色域变体（t-green/t-aqua/t-ember/t-violet/t-solar）。
  无法直接查看位图，改用逐帧像素直方 + ASCII 亮度栅格复核。
- 证据（数字）：
  - **暗场优先成立**：所有模式 `bright(>170)=0%`、`dark=23–46%`、`mid=54–77%`；首版曾整幅
    `bright=57%` 漂白（mean rgb(171,203,111)），修 bloom 阈值/强度、粒子 vFade、trail 叠加后
    降到 mean rgb(74,96,48)。
  - **P 配色模板 已证伪**：5 个不同 track 种子的平均色 rgb(75,96,49)/(92,79,62)/(76,61,86)/
    (77,95,98)/(95,99,71) —— 五个不同色相世界，没有默认紫渐变。
  - **G 灰色小字 已证伪**：活跃行在 600×90 裁切里 hot=44%、glyphColumns=99%、对比 389:1；
    高分辨率 ASCII 可见逐词字形（"the room breathed in ultraviolet" 清晰可分）。
  - **D 质感门槛 不命中**：画面是诚实生成流场，无模拟照片材质/无位图 hero。
- 修复的两处真实 bug（非 slop，但影响观感）：
  1. troika 默认字体走 jsdelivr CDN，无头构建与应用 CSP 都会挡 → 改打包本地
     `DejaVuSans-Bold.ttf`（`?url` 导入），字体不再依赖网络。
  2. troika `t.color` 要 CSS 字符串/hex，传 `THREE.Color` 对象或线性浮点会渲染成黑 —
     现在用 `'#'+color.getHexString()`（setRGB(…,SRGBColorSpace) 往返到正确 sRGB hex）。
- 新命中：无新增图鉴命中。模板文案/胶囊/眉题/编号口诀组在本交付面（纯 canvas、无 DOM）
  无可命中载体，符合预期。
