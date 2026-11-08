// Static knowledge-domain ontology fragment for KBV2-01.
// It declares metadata only; it does not register commands or business handlers.
export const knowledgeOntologyFragment = {
  namespace: 'nc.kb:',
  version: '1.0.0',
  apiMajor: 1,
  classes: [
    {
      id: 'nc.kb:KnowledgeEntry',
      label: '知识条目',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'spaceId', valueType: 'reference', required: true }],
    },
    {
      id: 'nc.kb:EntryRevision',
      label: '条目修订',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'bodyHash', valueType: 'hash', required: true }],
    },
  ],
  relations: [
    {
      id: 'nc.kb:relatedTo',
      from: 'nc.kb:KnowledgeEntry',
      to: 'nc.kb:KnowledgeEntry',
      direction: 'symmetric',
      evidenceRequired: false,
      authorizationPropagation: false,
    },
    {
      id: 'nc.kb:supersedes',
      from: 'nc.kb:EntryRevision',
      to: 'nc.kb:EntryRevision',
      direction: 'directed',
      evidenceRequired: false,
      authorizationPropagation: false,
    },
  ],
  constraints: ['KB-C3', 'KB-C4', 'KB-C8'],
  requires: [{ namespace: 'nc:', major: 1 }],
};
