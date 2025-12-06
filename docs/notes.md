# Notes

## 数据部分

- 需要保证传给 player 的 track uniqueKey 都是在数据库中有记录的，因为我们 currentTrack hook 需要依赖 uniqueKey 来查询元数据。
