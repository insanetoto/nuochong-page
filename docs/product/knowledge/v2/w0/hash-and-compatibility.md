# PLAN-02：P1契约、hash与兼容规范

**2026-11-08最新状态：本契约设计已由负责人批准冻结；实现可实现性反馈通过设计修订处理，运行能力仍planned。** 见[批准与准入记录](r1-acceptance-2026-11-08.md)。

2026-11-08 · 设计冻结版 `2.0.0-design.1` · **负责人已确认；实现可实现性反馈继续走设计变更**，对应[#102](https://github.com/insanetoto/nuochong-page/issues/102)。本轮没有把契约导入运行时。

## 1. 完整机器契约与版本

- [p1-command-contracts.json](p1-command-contracts.json)：35项P1候选命令，各含完整输入/输出JSON Schema、HTTP/CLI、权限/范围、审批、幂等、稳定错误和MCP暴露约定。
- [v0-command-baseline.json](v0-command-baseline.json)：从真实registry导出的20项knowledge及3项相关公共命令，原输入输出严格保持；运行命令总数仍59。
- [p1-schema-fixtures.json](p1-schema-fixtures.json)：每条输入/输出一个合成结构样例，只证明schema可验证，不是API成功或权限证明。
- [ontology-fragment.schema.json](ontology-fragment.schema.json)：KBV2-01自己的完整schema，独立于后续业务API实现。
- 当前v0校验器不支持pattern/maximum/oneOf。新契约校验必须支持这些关键词或将所有约束显式编译为等价校验；不能把新schema交给旧validator后跳过不识别部分。实现选择的依赖必须在对应npm包直接声明并锁定，不能依赖本轮设计QA临时使用的传递依赖。

新.v2用于spaces.create、publication publish/withdraw、search/source读取/answer、jobs get/list/events/cancel等破坏性字段变化；新entries.review.v1不悄悄改变既有changes.review.v1。相同命令版本不能同时接受两套互不兼容的响应。原CLI不带版本参数继续走v1；新CLI用`--command-version 2`选择v2，包schema/help必须说明，不能静默改老命令默认行为。CLI generic版本选择与新DTO按首个使用功能交付，10只联合收尾。

原contracts.md的计划表仍是全阶段概览；本目录35项及D01—D14是P1冻结候选的精确口径。排期/批量发布/消费者管理/能力启停/培训快照/媒体属于P2，不在P1注册ready。新候选治理proposalId字段、图查询asOfSnapshotId、整数weight(0–100)等在本包明确，旧草稿字段不混用；这些命令尚无运行用户，不以候选稿之间差异冒充运行时兼容。

## 2. HTTP、身份、二进制上传

业务JSON请求仍POST `/product/api/commands/{commandId}`。现有错误体保持`{code,requestId}`；不返回SQL/模型原始诊断。新响应schema明确含requestId，旧v1继续原DTO并保留x-request-id头，不硬加字段导致旧严格客户端失败。

身份/角色/平台治理资格来自可信上下文；请求不能带tenant/actor/roles/owner替代身份。published视图必须按当前空间+来源有效性过滤，manage视图额外要求edit/review/publish之一；概念与图谱统计同样过滤。当前产品任务仅返回本人任务；运维例外若需开放必须单独定义权限，不因knowledge:read自动查看他人问题。

新`knowledge.objects.upload.v1`采用multipart：metadata JSON对应schema，file为二进制part。CLI的`--file`只用于本地读取，不把本机路径作为服务端对象键；不把文件内容放argv。限制只在该路由的有界流式处理启用，不放大全站128KiB JSON bodyLimit。服务端复核实际字节、hash/MIME/magic/展开体积与空间权限；清洗文件名；对象引用绑定发起人/空间，不接受任意URL或客户端对象路径。

上传幂等hash包含元数据与实际bytes的sha256；输入hash与实测不同拒绝且不登记成功。隔离扫描未通过不返回可解析ready；缺扫描/解析依赖显式不可用，不静默跳过。imports.create只接受当前主体在同空间上传并已ready的objectRef，不允许用猜到的引用读取他人文件。

## 3. 幂等、审批与状态

- 写入键范围：actor+commandId+idempotencyKey；同键同输入返回原资源，同键异输入409；执行前重新校验当前凭据、权限和可见性，不能用旧幂等结果绕过撤权。
- CAS检查expectedRevision/baseSnapshot/policyRevision；业务写、发布指针、审批消费和outbox同事务；失败回滚，不吞掉冲突后报告成功。外部结果未知禁止自动重试。
- 内容审批：发布人通过既有access.approvals.create.v1对新命令完整目标创建批准，服务端重新计算目标摘要；审校人默认必须不同于发布人。审批主体仍是发布执行人，不无意要求第三个业务批准人。
- 独立治理：申请人经access.approval-requests.create.v1提交规范化目标，服务端保存proposalId/申请人/目标hash/有效期；另一可信治理人用access.approvals.create.v2批准同proposal；申请人执行policy.set携带proposalId/approvalId。批准者≠申请者，两人当前均需可信平台治理资格及access:manage；命令执行再次校验空间资格和策略版本。普通业务发布人不能打开豁免。
- 新治理路径扩展AccessKernel，不删除或放松旧非治理consumeApproval的同主体校验。旧审批hash算法标记保留；新目标使用下述c14n-v1，不能把旧hash解释成新hash。
- 取消先返回请求态，最终状态由持久任务决定；停止跟随不写取消。每文件事务性生成完整片段集，失败不落半成品；合并/拆分产生新片段并保留原定位与审计。

## 4. 规范化与hash

元数据规范`nc-c14n-v1`：对象属性名限制ASCII并按字典序排序；数组保留次序；只有有限安全整数/布尔/字符串/对象/数组，禁止浮点、NaN、-0、undefined和重复JSON属性名。字符串不做隐式Unicode正规化；JSON字符串使用标准引号/反斜线/控制字符转义，非ASCII直接UTF-8；无多余空白/换行。字节内容hash使用原始字节，不用元数据字符串正规化替代。解码阶段拒绝重复键或等价歧义。

作为集合的refs在构建目标前按ID排序并拒绝重复；正文段落/引用显示顺序不排序。schema最大长度按Unicode码点；文件大小按字节，不能混淆。

- `graphHash = SHA256(c14n({version:1, relationRevisionRefs, conceptRevisionRefs, assignmentRevisionRefs, supersessionRefs}))`。每个ref包含id+contentHash，引用指向已封存修订。变更关系原因/权重/概念标签/分配生成新修订，不能原地改ref内容。
- `reviewTargetHash = SHA256(c14n({version:1,spaceId,entryRevisionId,bodyHash,citationRefs,sourceRevisionRefs,aclRevision,policyRevision,graphHash,baseSnapshotId}))`。所有数据由服务端读取并与客户端expected值比对。审校绑定该hash，编辑任意覆盖字段则失效。
- `approvalTargetHash`在上述业务目标上增加commandId和目标动作特有字段，用服务端已有私有摘要密钥做带域分隔的HMAC-SHA256，域`nc-approval-target-v2`；schema里的hash字段均为64位小写十六进制。幂等键和approvalId/proposalId仅为传输/引用，不进入业务目标，但proposalId的服务端记录必须指向同目标和申请人。
- 审批记录保存算法版本，不将graphHash、reviewTargetHash与带密钥的批准摘要混作同一个hash。密钥留服务端，不在CLI计算或暴露。
- 快照manifest保存entries/source/relation/concept/assignment/supersession的确切ref、graphHash、policyRevision、approvalId与生效时间；空间只有一个current指针。aclEpoch/validityEpoch为实时失效元数据，历史数据不可用它们恢复旧权限。回退建立新快照及新的审校/审批，不直接把指针指回旧数据。

[canonical-vectors.json](canonical-vectors.json)提供跨语言结构/中文/顺序测试向量。数据库约束及hash目标一致性需实现时验证，schema样例不是这些验证的替代物。

## 5. v0兼容窗口及迁移

先expand新表/可空列，再按段落回填来源片段，保留原行号映射和v0修订；幂等回填键=(sourceRevisionId, locator, textHash)。旧引用不猜测PDF页码。

v1只返回原严格DTO和原kind集合；import.parse走jobs.v2。v1来源读取针对原文本保留content字段，对新二进制原文不能假装字符串下载；客户端使用sources.get.v2及受控下载引用。v1发布若无法验证新的完整审批与策略，返回CONTRACT_VERSION_REQUIRED，引导升级；不得以兼容为由继续同人自批或漏校graphHash。v2记录的任务/引用不能直接塞入v1 DTO。

兼容窗口至少覆盖本次P1试点和下一正式版本，退出须独立确认；不在本次删除旧列/命令。应用回退先停用v2写，保留原始对象和增量数据；有v2来源/发布时不允许旧程序越过新策略继续写。数据回滚使用配对备份和恢复演练，不能靠删新表声称无损。

## 6. 必须的语义负例

JSON Schema之外必须实现：locator区间起止/真实范围校验、同空间与有效来源、quote逐字匹配、概念无环/关系不自指、conflictsWith必需证据、治理双方资格、reviewer与publisher分离、hash/CAS/撤权、对象引用归属、任务所有权与未知结果恢复。schema结构通过不证明这些条件成立。

对应任务：01注册结构/版本；02增量模型；03治理与核心窄扩展；04有界上传/解析/任务；06片段/概念/关系与审校；07快照/审批；08图谱；14/15员工与任务页面；10联合CLI/MCP负例；11Linux/恢复/人工验收。
