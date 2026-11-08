// Static first-party ontology fragments shipped with the offline registry.
// These are metadata declarations only; they do not enable a runtime handler.
export const platformOntologyFragment = {
  namespace: 'nc:',
  version: '1.0.0',
  apiMajor: 1,
  classes: [
    {
      id: 'nc:Resource',
      label: '资源',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    },
    {
      id: 'nc:Organization',
      label: '组织',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    },
    {
      id: 'nc:Person',
      label: '人员',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    },
    {
      id: 'nc:Evidence',
      label: '证据',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'hash', valueType: 'hash', required: true }],
    },
    {
      id: 'nc:Publication',
      label: '发布',
      kind: 'event',
      status: 'planned',
      properties: [{ name: 'publishedAt', valueType: 'datetime', required: true }],
    },
    {
      id: 'nc:Capability',
      label: '能力',
      kind: 'entity',
      status: 'planned',
      properties: [{ name: 'version', valueType: 'string', required: true }],
    },
  ],
  relations: [],
  constraints: [],
  requires: [],
};
