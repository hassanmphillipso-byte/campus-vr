# 第一人称校服玩家样板

`player.glb` 为实际运行资产，`player.blend` 为可编辑源工程。`tools/build_player_avatar.py` 可在 Blender 中重建。运行使用完整骨骼身体与专用第一人称姿态，未使用预制商业动捕。

## 来源与授权

人体网格、默认骨架与权重来自 MakeHuman 官方仓库，固定提交 `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`：

- https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs
- https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/rigs
- 官方资产许可：https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md

官方核心资产 CC0；许可原文与下载URL/SHA256在 `source/makehuman/`。本项目重新制作校服配色、织物法线、鞋和鞋带，保留连续五指及蒙皮。未从社区下载其他服装，不把软件代码的许可当作资产许可。

## 运行约定

身高约1.76米，GLTF面向+Z。运行时身体朝向以相机yaw+π为目标并有限滞后跟随。骨骼名中的`.`和`-`转为`_`。`Head`网格只投影，眼睛相机独立，不随头骨晃动。校园与精细教室共用同一GLB/动作模块。校园支持坡度自适应短步幅、脚掌随坡面倾斜与腾空收腿。WebXR时暂隐藏桌面身体，尚无手柄驱动的人体追踪。

版本2增加肘膝/裤脚几何褶皱、织物法线与粗糙度、皮肤微法线/关节色差以及独立鞋面材质，全部纹理本地嵌入。仍为半写实实时模型，没有布料动力学、专业体育动捕或照片级皮肤。浏览器手机模拟不代表真机性能。

半径不超过0.075米的球使用右手单手拿取，其余双手托持。左右手指和拇指分别校准；实际位移驱动起停、跑步和坡面姿态，稳定相机不跟随头骨。落脚事件触发本地合成鞋底声音，♫面板可独立开关，校园总声音开关同时生效。
