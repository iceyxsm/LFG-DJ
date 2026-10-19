# DESIGN-BRIEF — LFG-DJ `src/visuals/`

## 决策卡

```yaml
任务: 用户在桌面全屏 Tauri 应用里听 Spotify，画面层把当前曲目渲染成生成式响应视觉，歌词织入构图
主要对象: 屏幕级生成艺术场域（shader 背景 + 粒子流）与当前歌词行
自然形态: 单张无边框 canvas，rAF 驱动，无 DOM 控件——输出是"画面"不是"界面"
领域惯例: 现场 AV / live-coded visuals（vicsek、line 风格）、音乐可视化器、album-art 光照；偏离惯例项：歌词是主角而非 HUD
参考与偏好: owner 指定 "Generative reactive art (shaders/particles) with lyrics woven in"、"cinematic、not karaoke box、live-coded AV meets album-art-aware gradient work"
表达强度: expressive（强色彩与动效成立，但每个强信号必须承担播放/歌词/能量职责）
视觉系统: 无组件系统——这是一张生成画，语言由 mood-palette + GLSL 场 + 一套排印规则组成
专业引擎: Three.js (WebGL2, custom ShaderMaterial)，2D canvas 只做歌词纹理
衔接合同: window.__dj 是唯一桥；视觉模块只读、自包含、可独立 destroy
目标画面: 1920×1080 全屏，曲目中段、活跃歌词行 + 环绕粒子 + 域扭曲背景
```

## VISUAL-THESIS（工作面型产物——命题仍锁定，因为它是生成画）

```yaml
world: 听众坐在一块暗室里，整面墙是一团会呼吸的光雾，当前那句歌词是雾中唯一被点亮的东西
tension: 全屏混沌流场（永动的域扭曲 + 粒子群）↔ 静止居中的当前歌词行（每次换行才被打破）
memorable_moment: 换行瞬间——旧行离散成粒子退入背景纹理，新行以主色点亮，背景场域整体呼吸一次
identity_strategy: 每首歌由 track.id 长出固定 mood（palette + 流场参数），同一首歌永远长一个样；专辑封面色相做 35% 微调——专辑艺术是"光源颜色"，不是贴图
manifestations:
  - 背景场: 域扭曲 fbm + 矢量势流场粒子，色域来自 mood palette，能量仅做倍乘不做主题色
  - 歌词层: 活跃行大字居中（scale-breathe on line onset），行内逐词上色窗口（有 word times 时），过期行进入 trail 层缓慢下坠成纹理
  - 微观: mood 决定噪度/粒子数/辉光；mic energy 只做 intensity/尺寸乘子，不改色
```

## 图像/资产来源清单

- 全部画面由 GLSL + Canvas2D 实时生成，无位图资产。专辑封面图（`__dj.track.albumArtUrl`）仅用于在 CORS 允许时提取色相做 palette 微调；失败静默回退 mood seed palette。不显示封面本体（避免把"专辑图贴进视觉"变成贴图瀑布）。
- 歌词纹理：CanvasTexture，等宽网格逐词采样。
- icon/装饰：无。

## 工具清单

| 能力 | 候选 | 选择 | 理由/职责 |
|---|---|---|---|
| WebGL 封装 | Three.js / regl / raw WebGL | **Three.js** | owner 指定偏好，迭代速度；只负责 shader pipeline + 点精灵粒子，不引入场景图复杂度 |
| 粒子 | 自写 GPU 粒子 / three points | **自写 point-sprite shader** | 需要按粒子种子在 shader 内分流场，CPU 每帧更新数万点太慢；这是任务特有逻辑 |
| 歌词纹理 | DOM 叠层 / canvas 纹理 | **canvas 纹理 + shader 合成** | 歌词要进入同一 bloom/trail 反馈循环，DOM 叠层无法被 shader 后处理吃掉 |
| 反馈 trail | EffectComposer AfterimagePass | **自写简单 ping-pong** | 只需要 fade+mix，全 composer 过重；探针证明 WebGL2+half-float RT 可用 |

## 关键技术合同（与另一 agent 的边界）

- 只读 `window.__dj`；永不写回。每帧读取，无事件。
- `__dj` 不存在 → attract mode：内部时钟驱动，缓慢漂移光雾 + 无歌词；`__dj` 出现/消失切换平滑。
- `init(canvas)` 返回的 handle 与 `destroy()` 是全部公开面；再加一个可选 `__djVisual` 调试钩子（只读 snapshot）。
- 零依赖假设：不 import 'three' 的 bare specifier——由 embedding 层决定 bundler。模块只用相对路径 + 全局 `three` 或由 `init(canvas, {THREE})` 注入？→ **决定：npm 包 `three` 正常 import，README 说明宿主需提供 bundler/依赖**（Tauri 脚手架几乎必有 vite/npm；这是行业惯例，README 写明）。但为让本文件可独立 headless 测试，harness 里用 CDN 版 three 替身——不，**更简单：模块依赖注入**。`init(canvas, deps?)`；`deps.THREE` 缺省时 `import('three')` 动态加载。README 写清两种用法。
