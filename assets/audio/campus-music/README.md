# 校园场景配乐

18首作品通过11组场景歌单在校园、独立教室与运动场景中播放。许可和逐曲署名见项目根目录 `music-credits.html` 及本目录 `manifest.json`。

- Kevin MacLeod 10首：CC BY 4.0，保留作者、作品、来源与许可链接。
- OpenGameArt 5首：CC0。
- OpenTracks 3首：按网站与作者条件用于游戏背景音乐。Morning采用官方Track 2；昼下がり気分、SUMMER TRIANGLE采用Track 1。官方条款：https://opentracks.com/help/articles/license/ 。作者条件：https://opentracks.com/creator/detail/101 与 https://opentracks.com/creator/detail/19 。

Sherwood另外裁掉含长停顿的前4.2秒引子。各曲经过响度调整、首尾近静音修整、MP3转码及CVBGM1游戏资源转换；不提供这三首原音源的本地试听或下载入口。原始文件保存在 `_quarantine/bgm-integration/originals/`，`tools/serve.py`拒绝对隔离目录的GET/HEAD请求。资源封装用于与游戏绑定，不是不可破解的DRM。

运行清单记录最终文件SHA256、字节数、时长、LUFS与真峰值。文件按需读取，Web Audio以24kHz解码；最多保留2首解码缓存。下一曲在结束前预取，使用2.4秒交叉淡化。换歌属于过渡处理，不宣称每首原曲都是无缝循环作品。

## 本地资源恢复

原始音频与约41 MB运行资源不纳入Git；本机已齐全。新机器先按许可恢复资源，再启动项目：

```bash
python3 tools/fetch_campus_music.py
python3 tools/build_campus_music.py
python3 tools/serve.py --port 8790
```

需要Python requests与ffmpeg/ffprobe。fetch只下载缺失文件，不保存临时签名下载链接。后续部署使用构建后的 `.bgm` 与清单，不包含 `_quarantine/` 或原曲试听素材。

## 冒险关卡配乐

基地探索使用Where was I? / Sherwood；能源桥使用MintoDog的Sci-fi Puzzle In-Game 1（CC0）；战机使用Alex McCulloch / Pro Sensory的Space Shooter (Loop)（CC0）。两首新增曲的来源、哈希和恢复链接在候选manifest中。地图/方块/护航增益分别为0.75/0.6/0.8，另受统一音量和读题压低控制。暂停会冻结配乐播放位置，恢复后续播；退出恢复资料与考核歌单。

## 体育试玩后的调整（2026-10-09）

正式实测、自由训练、原场地竞赛和乒乓陪练优先按当前活动选曲，避免跑道弯道或足球点球位置退回校园歌单。篮球/足球/跑步使用体育歌单（增益0.7），游泳保持泳馆歌单（0.65），跳绳使用同曲轻背景歌单（0.4）；没有新增音源。训练暂停同步冻结配乐，继续续播，退出清理暂停；规则菜单、结算和发令倒计时再压低至相应增益的23%。跳绳计分仍按可见绳圈与动作，不按歌曲节拍。
