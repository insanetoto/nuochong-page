# KBV2-01 可直接实现的本体注册规范

**2026-11-08最新状态：负责人已批准R1，#104 Ready，按验收记录的固定SHA与有限范围实现；未开始编码或部署。** 见[批准与准入记录](r1-acceptance-2026-11-08.md)。

版本1.0.0设计冻结 · 对应[#104](https://github.com/insanetoto/nuochong-page/issues/104) · **R1有限准入已验收，KBV2-01 Ready；实现尚未验收**。

## 输入、输出与边界

输入为受信任第一方发布包的manifest.ontology片段，结构见[ontology-fragment.schema.json](ontology-fragment.schema.json)，合成例见[ontology-fragment.example.json](ontology-fragment.example.json)。CLI/用户/模型不能提交动态本体、模块路径、SQL或可执行脚本。所有类/关系的status与产品实现状态分开，登记一个类不代表该产品已实现。

平台内部提供只读OntologyRegistry，建议模块packages/platform/ontology-registry.mjs，与现有PluginRegistry组合，不能替换可信授权核心。输入是一组静态片段+可信命名空间登记表；成功结果为不可变聚合{namespaces,classes,relations,constraints,ontologyHash}，可按classId/relationId查询；失败抛固定领域错误并不发布部分注册结果。不新增业务HTTP/MCP/CLI能力，因此不凭内部模块虚构commandId。

命名空间归属固定：nc:平台；nc.org:organization；nc.access:access-management；nc.kb:knowledge；nc.tool:enterprise-tools；nc.learn:learning。nc.ext:留后续，不接受租户动态扩展。所有class/relation ID必须属于片段自己的命名空间；引用可指向已声明requires的命名空间。新工具/培训只保留planned声明，禁用插件不能开启其写能力。

## 加载顺序与不可变性

1. 校验完整JSON Schema；拒绝额外字段，不执行任何输入文本。
2. 校验可信插件ID与命名空间所有权、apiMajor和本体版本；缺依赖/环拒绝。
3. 两阶段加载：先收集全部类，再解析关系端点和依赖。不能因JSON排列顺序导致前向引用随机失败。
4. 检查类ID、关系ID、属性名、constraint ID重复；类和关系跨类型也不得复用ID；无关插件不能覆盖已有ID。
5. 校验关系端点存在、授权传播恒false。supersedes的端点必须是nc.kb:EntryRevision；relatedTo/conflictsWith的端点必须是KnowledgeEntry。注册层只验证类型，不代替数据库实例级约束。
6. 以hash-and-compatibility.md的元数据规范化计算ontologyHash，深复制并递归冻结；不持有调用方可变对象引用。任何一步失败保留旧注册快照。
7. 重载相同namespace/version/contentHash幂等；同version不同内容拒绝；有兼容新版本则通过显式发布包/升级记录替换，不提供员工在线编辑入口。

缺依赖和命名空间冲突不可通过把权限模块disabled解决。注册表不访问数据库或Harness，不改变实例权限、任务状态或审批。load日志只记录命名空间/版本/hash/结果码，不记录业务资料或凭据。

## 版本规则

- apiMajor仍为1；ontology.version按三段整数版本，产品版本与commandId版本独立。
- 增加新类/关系/可选属性是minor；删除、必填收紧、类型/方向/授权语义变化是major，必须另行批准兼容迁移。
- 语义“同名换义”不能靠schema自动识别，审查记录必须说明兼容性，不将自动校验视为语义证明。
- 首期支持ontology major 1；major 2拒绝。旧快照登记的版本/hash不可被覆盖，回退重新加载旧第一方发布包并记录结果，不删历史。
- 现有命令后缀只允许.v1。为了后续已批准的.v2契约，PluginRegistry仅在明确的command major allowlist中接受1/2，不用宽泛正则接受任意major；不在KBV2-01注册尚未实现的v2命令或改动其HTTP处理。
- v0 foundationManifests暂时没有ontology字段，保持可加载。新增注册过程从平台内置nc:片段及批准的knowledge静态片段组合，不强迫旧工具/培训实例伪造完整实现。

## 稳定错误与验收矩阵

| 用例 | 预期 |
| --- | --- |
| 合法nc:基础+nc.kb:片段，顺序互换 | 相同ontologyHash、可只读查询 |
| schema额外script/path/SQL字段 | ONTOLOGY_SCHEMA_INVALID，无部分注册 |
| 插件伪造其他命名空间、ID前缀错误 | ONTOLOGY_NAMESPACE_CONFLICT |
| 重复ID/属性名、不同内容复用版本 | ONTOLOGY_ID_CONFLICT / ONTOLOGY_VERSION_CONFLICT |
| 缺requires、依赖环、关系不存在端点 | ONTOLOGY_DEPENDENCY_UNAVAILABLE / ONTOLOGY_DEPENDENCY_CYCLE / ONTOLOGY_REFERENCE_INVALID |
| platform/ontology major不兼容 | ONTOLOGY_INCOMPATIBLE_VERSION |
| authorizationPropagation=true | ONTOLOGY_SCHEMA_INVALID，不产生隐式授权 |
| supersedes指向条目，非修订 | ONTOLOGY_REFERENCE_INVALID |
| mutate输入或registry返回嵌套对象 | 注册快照/hash不变；写入拒绝或隔离 |
| 同片段重复加载、旧版本回退 | 幂等且有可核验版本/hash记录 |
| 新.v2命令metadata与不支持.v3 | 只接受明确allowlist，不注册未实现处理器 |
| 既有59项命令、插件加载与依赖负例 | v0行为保持；不触发数据库迁移、真实模型或部署 |

DeepSeek在独立分支实现上述模块、单元测试和现有组合回归，交付源码SHA与测试证据，ChatGPT预审。此文与schema是设计交付，不是已完成该实现；本轮设计校验没有执行真实新注册器，因为它尚未实现。
