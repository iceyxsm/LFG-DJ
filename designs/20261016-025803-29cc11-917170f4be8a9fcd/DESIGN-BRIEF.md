# DESIGN-BRIEF — `src/remotion/compositions/LyricComposition.tsx`

## Decision card

```yaml
任务: 在 WebGL 生成场之上，把 Spotify 同步歌词实时渲染成 kinetic-typography 歌词层 — 字本身就是演出
主要对象: 当前那句歌词（逐词点亮的 kinetic type），其次是上一行残影/下一行预告与 ambient 状态
自然形态: 全屏透明 DOM 叠层（#root → #lyric-layer），rAF 逐帧重渲染，纯 positionMs 函数
领域惯例: Apple Music 歌词视图 × 歌词 MV；偏离：不吃掉引擎画面，与 mood 场共生而非盖掉
参考与偏好: owner "ANIMATION FOR THE LYRICS AND ALL" — words ARE the show；NOT karaoke-box, NOT tiny gray captions
表达强度: expressive（大号字重 + accent 点亮 + 能量呼吸成立，但每个动效承担进度/能量/换行职责）
视觉系统: 无组件库——语言 = mood.palette + 字号字重的极端对比 + transform/opacity 动效
专业引擎: React DOM + remotion 的 interpolate/Easing（纯时间函数）；与 WebGL canvas 叠加
衔接合同: LyricLayer mount 逐帧喂 props；palette 0..1 rgb → css rgb()；lyricPulse 缩放换行脉冲
目标画面: 1920×1080，synced 模式一句活跃行大号居中 + 下一行小字预告，bass/treble 能量呼吸
```

## Identity inventory
- **主体**：LFG-DJ 应用。无 logo / 无品牌标。`index.html` 只有文字 `<title>LFG DJ</title>`；overlay `.brand` 是纯字标。
- **结论**：无既有标识可用 → 本层不需要标识槽（owner 明确要"字即演出"，不是 branding）。文字处理 = 排印，不造符号。
- **字体**：仓库自带 `DejaVuSans-Bold.ttf`（引擎 troika 用）。对显示级 kinetic type 太普通 → 引入 `@fontsource/archivo-black`（400 极粗，海报感）做主字 + `@fontsource/space-grotesk`（500/700）做次行与 ambient。均为 self-hosted woff2，过 CSP `font-src:'self'`(default-src 兜底)。

## 参考参照（precedent）
- 参照 Apple Music 歌词视图先例的"**活跃行极大居中 + 逐词 accent 填充 + 邻近行退晕**"章法；落到本产物 = 中心重力构图 + word-fill karaoke + slot 衰减。
- 参照歌词 MV 的"**每个换行是一次事件**"——用 lyricPulse×energy 驱动的入场 pulse + 退场抬升。

## VISUAL-THESIS

```yaml
world: 流动的 mood 光雾之上，当前那句词是唯一被点亮、会呼吸的东西
tension: 永远居中的大号活跃词（逐词被 accent 吃掉） ↔ 过去行上飘溶解 / 未来行下沉待亮
memorable_moment: 换行——旧行向上浮散，新行带 pulse 落位，逐词被暖色 accent 顺次点亮
identity_strategy: 不盖 HUD 不加卡片，纯排印承担演出；accent 是"正在唱"的声音，primary 是上下文
manifestations:
  - synced 活跃行: 8vh 级 Archivo Black 居中，逐词 clip/weight/opacity 揭示，bass 推 scale
  - 上下文行: 上一行缩小上浮淡出，下一两行小字 primary 下沉——形成时间纵深
  - plain 模式: 长文不做墙，三行克制漂移带（低透明、慢 scroll）
  - ambient(none/loading/instrumental): '♪' + 呼吸点/标题处理，无词也成立
  - 能量: bass→letter-spacing/scale 呼吸，treble→accent 词微光 shimmer；字始终可读
```

## SURFACE-MANIFEST
- synced/active+context 行 · synced/instrumental 间隙 · plain 漂移 · loading · none · instrumental · paused

## COMPONENT-BEHAVIOR-MAP
- 无交互示能（pointer-events:none，纯展示层）。所有"可动"都是时间函数，非用户输入。

## 工具清单
| 能力 | 选择 | 职责/理由 |
|---|---|---|
| 逐帧重渲染 | react-dom（已装） | mount 已用 createRoot + useSyncExternalStore |
| 时间插值/缓动 | remotion interpolate/Easing/spring（已装 4.0.535） | 纯函数，无 Player 依赖，独立可用 |
| 显示字体 | @fontsource/archivo-black + space-grotesk | self-hosted woff2，CSP-clean；DejaVu 兜底 |
| 歌词分层 | 自写 positionMs→slot 计算 | 任务特有：line 时长归一化为 local progress |
| 逐词 timing | 自写 uniform-split | LRC 无词级时间戳 → 均分伪词时序 |

## 图像来源清单
- 全层无位图/生成图/icon。文字与符号（'♪'、点）为排印元素；背景是引擎 canvas 实时光雾。
- '♪' 与呼吸点为 Unicode 符号，非手写 SVG/icon 路线。

## 终态
- **首见描述（3秒）**："正中一大句歌正在逐词变亮成暖橙，上面一句刚飘走变淡，下面一行小字等着被唱。" — 主要对象=当前歌词行，主任务=跟着唱，下一步=看下一行。
- **概念锚点**：synced 活跃行居中逐词点亮 ✓（proof/sync-*.png）；exiting 上浮溶解 ✓；upcoming 下沉待亮 ✓；plain 三行漂移 ✓（plain.png）；ambient '♪'+呼吸点 ✓（loading/instr/none.png）；bass scale/letterSpacing + treble accent-lift ✓；paused 冻结 sung 进度但 ambient 继续慢呼吸 ✓（paused.png）。
- **强项**：逐词 fill 是 0..1 连续函数（颜色/模糊/上浮/光晕同步过渡），非开关式 karaoke；换行有 lyricPulse×energy 入场脉冲 + 词完成 overshoot；长行自动降档保 hero 块。
- **J1 主角时刻**：当前行被 accent 逐词"吃掉"的那次 reveal。J3 一句话：这是一块"当前那句歌在光雾中逐词点亮"的全屏 kinetic 歌词层。
- **assurance**：SELF_REVIEW_ONLY（无独立 reviewer；已用 headless Chrome 实渲 9 帧各模式像素复核）。
