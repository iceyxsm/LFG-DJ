# DESIGN-BRIEF — LFG-DJ `src/visuals/` engine

## 决策卡

```yaml
任务: 桌面全屏 Tauri 应用里，把正在播放的 Spotify 曲目实时渲染成生成式响应视觉，歌词织进构图
主要对象: 屏幕级生成艺术场域（域扭曲 fbm 背景 + curl 粒子流）与当前歌词行
自然形态: 单张无边框 <canvas>，rAF 驱动，无 DOM 控件——产物是"画面"不是"界面"
领域惯例: 现场 AV / live-coded visuals / 音乐可视化器；偏离：歌词是主角而非 HUD 注脚
参考与偏好: owner 指定 "Generative reactive art (shaders/particles) with lyrics woven in"、"cinematic、dark-first、NOT a karaoke box"
表达强度: expressive（强色彩与动效成立，但每个强信号必须承担播放/歌词/能量职责）
视觉系统: 无组件库——语言 = mood-palette + GLSL 场 + 一套排印规则
专业引擎: Three.js WebGL2（renderer/着色器）+ postprocessing(bloom) + troika-three-text(SDF 歌词)
衔接合同: window.__dj 只读桥；StateAdapter.update(dt)→FrameSignals 是唯一入口
目标画面: 1920×1080 全屏，曲目中段、活跃歌词行 + 环绕粒子 + 域扭曲背景
```

## VISUAL-THESIS

```yaml
world: 暗室里一面会呼吸的光雾墙，当前那句歌词是雾中唯一被点亮的东西
tension: 全屏永动的混沌流场（域扭曲 + 粒子群）↔ 静止居中的当前歌词行（换行瞬间被打破）
memorable_moment: 换行——旧行离散退入粒子场，新行以 accent 点亮，场域随 linePulse 整体呼吸一次
identity_strategy: 每首歌由 track 身份长出固定 mood（palette+params），同曲同世界；专辑封面色做 35% 微调当"光源颜色"，不贴图
manifestations:
  - 背景场: 域扭曲 fbm，色域=mood.base/primary/counter，energy 只乘强度不改色
  - 粒子场: curl 噪声平流，bands[0] 推径向膨胀，trailDecay 拖尾，linePulse 触发散射
  - 歌词: 活跃行大号 accent 居中呼吸；过期行收缩溶解进场；plain→克制 marquee；attract/none→无字
  - 后处理: bloomGain×energy 驱动的 bloom + vignette/色差，制造电影感
```

## 工具清单

| 能力 | 选择 | 职责 / 理由 |
|---|---|---|
| WebGL2 渲染 | **three** | renderer + ShaderMaterial + Points；owner 指定 |
| 后处理 | **postprocessing** | EffectComposer + BloomEffect(+Vignette/ChromaAb) |
| 歌词文字 | **troika-three-text** | SDF 场景内文字，可被 bloom/trail 吃掉，非 DOM 叠层 |
| 噪声/粒子 | 自写 GLSL | 任务特有：域扭曲 fbm + curl 平流；CPU 逐帧更新数万粒子太慢 |
| 拖尾反馈 | 自写 ping-pong RT | trailDecay 逐帧衰减；比 EffectComposer Afterimage 更贴合"融入场"语义 |

## 图像/资产来源清单
- 全部画面由 GLSL + SDF 实时生成，无位图、无生成图、无 icon。
- 专辑封面仅取色（35% hue 微调），不显示本体。
- 质感门槛不路由到 image_generate：本画面是诚实的生成式流场，不声称照片级材质/光照 hero。

## 关键边界（与并行 agent）
- 只读 `window.__dj`；StateAdapter 是唯一懂 `__dj` 形状的地方。
- 并行 agent 改 `src/state.ts`/`src/mic.ts` 满足该契约——我在 adapter 里给 `lyricsMode`/`plainLyrics` 加了 `__dj` + `__djState` 双源回退，宿主滞后也不崩。
- `engine` 导出 `start(canvas)`/`stop()`；`main.ts` 已调用 `visualsEngine.start(canvas)`。

## 性能预算
- DPR 上限 1.75；粒子数按设备能力封顶（≤ mood.params.particleCount 且 ≤ 22000）。
- attract/none 模式降低粒子密度与 octaves。
- stop() 完整 dispose（geometry/material/RT/composer/troika text）。
