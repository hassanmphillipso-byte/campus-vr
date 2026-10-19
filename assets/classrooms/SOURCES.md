# 教室资产来源

- `textures/wood_*.jpg`：Poly Haven / Wood Floor，作者 Dimitrios Savva，CC0。来源 https://polyhaven.com/a/wood_floor ，许可 https://polyhaven.com/license 。本地使用1K diffuse、OpenGL normal、roughness。
- `furniture.glb`：本项目通过 Blender 脚本 `tools/build_classroom_furniture.py` 原创生成的米制家具；可编辑源文件为 `furniture.blend`。
- 环境光复用项目已有 `assets/sky/campus_sky_2k.hdr`，Poly Haven 天空资产。
- 家具资产共8类：课桌、椅子、工作台、显示器、键盘、资料柜、暖气片、关节教学模型。生成脚本与 `.blend` 均随项目保存。
- 后处理依赖：Three.js r186 的官方 EffectComposer、GTAOPass、OutputPass 及其依赖，来源 `https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/`，本地存于 `vendor/three/examples/jsm/`；MIT 许可见 `vendor/three/LICENSE`。运行时不访问 CDN。
