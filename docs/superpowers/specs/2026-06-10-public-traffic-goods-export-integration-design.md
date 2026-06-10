# 公域日报商品总表接入 Design

## Goal

让 `npm run public-traffic-report` 自动下载当天商品总表、刷新平台商品 ID 到端内 ID 的映射，然后再生成公域数据日报，避免日报使用过期映射或缺少新品识别基础数据。

## Scope

包含：

- 公域日报主流程开始时下载支付宝商品总表。
- 商品总表保存到当天目录：`output/YYYY-MM-DD/商品总表_YYYY-MM-DD.xlsx`。
- 映射同步日志保存到当天目录：`output/YYYY-MM-DD/商品ID映射同步日志_YYYY-MM-DD.log`。
- 解析商品总表并刷新 `config.productIdMappingPath`，未配置时使用 `config/product-id-map.json`。
- 刷新成功后，后续公域曝光/访问数据聚合使用最新映射。
- `output/latest/` 可继续保留 latest/debug 快照，但当天目录是主产物位置。

不包含：

- 自动修改商品。
- 新增商品治理动作执行。
- 改变飞书卡片结构。
- 新增抓取页面。

## Data Flow

1. CLI 加载 `.env` 和配置。
2. 创建 `output/YYYY-MM-DD/`。
3. 下载商品总表到 `商品总表_YYYY-MM-DD.xlsx`。
4. 从商品总表解析平台商品 ID 与端内 ID 映射。
5. 备份并刷新 `product-id-map.json`。
6. 写入 `商品ID映射同步日志_YYYY-MM-DD.log`。
7. 继续执行原公域曝光、公域访问、分析、输出和飞书推送流程。

## Error Handling

- 商品总表下载失败：本次日报失败，不继续生成可能映射过期的日报。
- 商品总表解析映射数量过少：本次日报失败，避免写入坏映射。
- 映射写入失败：本次日报失败。
- 商品总表刷新成功但后续日报失败：保留商品总表和同步日志，便于排障。

## Output Files

新增当天产物：

- `output/YYYY-MM-DD/商品总表_YYYY-MM-DD.xlsx`
- `output/YYYY-MM-DD/商品ID映射同步日志_YYYY-MM-DD.log`

现有产物保持：

- Markdown：`公域数据日报_YYYY-MM-DD.md`
- XLSX：`公域数据日报_YYYY-MM-DD.xlsx`
- JSON：`公域数据上下文_YYYY-MM-DD.json` 及抓取中间数据。

## Testing

- 路径构建包含商品总表和映射同步日志中文文件名。
- 商品总表解析写映射逻辑可被公域日报 CLI 复用。
- `publicTrafficReport` 源码包含下载商品总表、刷新映射，再加载映射并生成日报的顺序。
- 商品总表刷新失败时 CLI 不继续生成日报。
- `npm test` 通过。
- `npm run build` 通过。

## Success Criteria

- 在 `master` 上运行 `npm run public-traffic-report` 后，`output/YYYY-MM-DD/` 能看到商品总表 XLSX、商品 ID 映射同步日志、公域日报 Markdown/XLSX/JSON 和各抓取中间 JSON。
- 日报中的端内 ID 使用本次刚下载的商品总表映射。
- 飞书通知仍正常发送。
