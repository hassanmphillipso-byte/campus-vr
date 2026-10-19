# 体育公版资产来源

接入日期：2026-10-07。全部模型本地加载，不依赖外部CDN。

## ks_gameassets：Sport Bundle（CC0）

- 作者页：https://opengameart.org/content/sport-bundle
- 原始工程附件：https://opengameart.org/sites/default/files/blend_3.zip
- 原始许可：https://opengameart.org/sites/default/files/cc0_licence.txt
- 对应 `source/Basketball.blend`、`Football.blend`、`Handball.blend`、`Volleyball.blend`。
- 改编：保留网格／接缝／UV，烘焙修改器、统一中心与单位半径，适配PBR粗糙度；手球改为青绿与米色配色便于区分足球。运行时按现有刚体半径缩放，视觉与碰撞保持对应。

## RayB2：Table Tennis Set（CC0）

- 作者页：https://opengameart.org/content/table-tennis-set
- 原始工程附件：https://opengameart.org/sites/default/files/table%20tennis.blend
- 作者页标注CC0；模型原始工程 `source/TableTennis.blend` 保留。
- 改编：从源工程拆出球台、红色球拍和球；保留原作者内嵌128×128调色纹理，GLB打包贴图；球台调整为2.74×1.525米、台面约0.76米，并修正源工程偏移；球拍调整到手柄握持点，球归一化到单位半径。

## 文件和复现

- `CC0-1.0.txt`：下载的原始CC0许可文本。
- `manifest.json`：7个运行资产、作者、源工程、哈希、三角面和大小。
- `source-audit.json`：原始工程对象、材质和内嵌图片检查。
- 导出：`/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_open_sports.py`。
- 来源不是AI生成；几何及纹理来自以上作者。本项目做尺度、轴向、材质及游戏接入适配。
- 未引入CMU动作数据或Mixamo资源，现有角色与程序动作来源仍按项目原记录。
