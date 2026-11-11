import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJson, sha256Hex } from '../canonical-json.mjs';
import {
  OntologyRegistry,
  OntologyError,
  ONTOLOGY_ERRORS,
  ontologyEntriesFromManifests,
} from '../ontology-registry.mjs';
import { platformOntologyFragment } from '../ontology-fragments.mjs';
import { knowledgeOntologyFragment } from '../../../plugins/knowledge/ontology.mjs';
import { PluginRegistry, foundationManifests } from '../plugin-registry.mjs';
import { commands as runtimeCommands } from '../../../tools/nuochong-cli/src/registry.mjs';

const entries = () => [
  { pluginId: 'platform', fragment: platformOntologyFragment },
  { pluginId: 'knowledge', fragment: knowledgeOntologyFragment },
];

const expectCode = (fn, code) => {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof OntologyError, `expected OntologyError, got ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  });
};

const clone = (value) => structuredClone(value);

test('canonical vectors match nc-c14n-v1 and reject non-canonical values', () => {
  const vectors = JSON.parse(readFileSync(
    new URL('../../../docs/product/knowledge/v2/w0/canonical-vectors.json', import.meta.url),
    'utf8',
  ));
  for (const vector of vectors.cases) {
    assert.equal(canonicalJson(vector.value), vector.canonical);
    assert.equal(sha256Hex(canonicalJson(vector.value)), vector.sha256);
    assert.equal(createHash('sha256').update(canonicalJson(vector.value)).digest('hex'), vector.sha256);
  }
  for (const invalid of [null, undefined, NaN, Infinity, -0, 1.5, { a: undefined }, { '知识': 1 }]) {
    assert.throws(() => canonicalJson(invalid), /canonical value|safe integers|printable ASCII|undefined/);
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cyclic/);
});

test('loads the platform and knowledge fragments, is order independent and deeply frozen', () => {
  const first = new OntologyRegistry().load(entries());
  const second = new OntologyRegistry().load([...entries()].reverse());
  assert.equal(first.ontologyHash, second.ontologyHash);
  assert.deepEqual(first.listNamespaces().map((entry) => entry.namespace), ['nc.kb:', 'nc:']);
  assert.equal(first.getClass('nc.kb:KnowledgeEntry').label, '知识条目');
  assert.equal(first.getRelation('nc.kb:relatedTo').direction, 'symmetric');
  assert.equal(first.getClass('nc.kb:Missing'), null);
  assert.ok(Object.isFrozen(first.snapshot));
  assert.ok(Object.isFrozen(first.getClass('nc.kb:KnowledgeEntry')));
  assert.throws(() => { first.getClass('nc.kb:KnowledgeEntry').label = 'changed'; }, TypeError);
});

test('the runtime command surface includes the approved KBV2-03 v2 additions', () => {
  assert.equal(runtimeCommands.length, 66);
  assert.deepEqual(runtimeCommands.filter((command) => command.id.endsWith('.v2')).map((command) => command.id).sort(), [
    'access.approvals.create.v2',
    'knowledge.spaces.create.v2',
  ]);
  assert.equal(foundationManifests.every((manifest) => manifest.commands.length === 0), true);
});

test('load logging only exposes namespace, version, hash and result code', () => {
  const logs = [];
  new OntologyRegistry().load(entries(), { logger: (entry) => logs.push(entry) });
  assert.equal(logs.length, 2);
  for (const log of logs) {
    assert.deepEqual(Object.keys(log).sort(), ['code', 'hash', 'namespace', 'version']);
    assert.equal(log.code, 'OK');
    assert.match(log.hash, /^[0-9a-f]{64}$/);
  }
});

test('the approved ontology-fragment example loads unchanged', () => {
  const example = JSON.parse(readFileSync(
    new URL('../../../docs/product/knowledge/v2/w0/ontology-fragment.example.json', import.meta.url),
    'utf8',
  ));
  const registry = new OntologyRegistry().load([
    { pluginId: 'platform', fragment: platformOntologyFragment },
    { pluginId: 'knowledge', fragment: example },
  ]);
  assert.equal(registry.getClass('nc.kb:KnowledgeEntry').label, '知识条目');
  assert.equal(registry.getRelation('nc.kb:supersedes').from, 'nc.kb:EntryRevision');
  assert.deepEqual(registry.listConstraints(), ['KB-C3', 'KB-C4', 'KB-C8']);
});

test('input mutation does not change the published snapshot', () => {
  const mutable = clone(entries());
  const registry = new OntologyRegistry().load(mutable);
  const hash = registry.ontologyHash;
  mutable[1].fragment.classes[0].label = 'mutated';
  assert.equal(registry.getClass('nc.kb:KnowledgeEntry').label, '知识条目');
  assert.equal(registry.ontologyHash, hash);
});

test('schema rejects extra executable fields, bad labels and authorization propagation', () => {
  const extra = clone(knowledgeOntologyFragment);
  extra.script = 'process.exit()';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: extra }]), ONTOLOGY_ERRORS.SCHEMA_INVALID);

  const path = clone(knowledgeOntologyFragment);
  path.classes[0].properties[0].path = '/tmp/x';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: path }]), ONTOLOGY_ERRORS.SCHEMA_INVALID);

  const label = clone(knowledgeOntologyFragment);
  label.classes[0].label = 'x'.repeat(81);
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: label }]), ONTOLOGY_ERRORS.SCHEMA_INVALID);

  const propagation = clone(knowledgeOntologyFragment);
  propagation.relations[0].authorizationPropagation = true;
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: propagation }]), ONTOLOGY_ERRORS.SCHEMA_INVALID);
});

test('namespace ownership and id prefixes fail closed', () => {
  expectCode(() => new OntologyRegistry().load([
    entries()[0],
    { pluginId: 'organization', fragment: knowledgeOntologyFragment },
  ]), ONTOLOGY_ERRORS.NAMESPACE_CONFLICT);

  const foreign = clone(knowledgeOntologyFragment);
  foreign.classes[0].id = 'nc.tool:Foreign';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: foreign }]), ONTOLOGY_ERRORS.NAMESPACE_CONFLICT);

  const unknown = clone(knowledgeOntologyFragment);
  unknown.namespace = 'nc.ext:';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: unknown }]), ONTOLOGY_ERRORS.NAMESPACE_CONFLICT);

  expectCode(() => new OntologyRegistry().load([
    entries()[0],
    { pluginId: 'untrusted', fragment: knowledgeOntologyFragment },
  ]), ONTOLOGY_ERRORS.NAMESPACE_CONFLICT);
});

test('duplicate class/relation/property/constraint ids are rejected', () => {
  const duplicateClass = clone(knowledgeOntologyFragment);
  duplicateClass.classes.push(clone(duplicateClass.classes[0]));
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: duplicateClass }]), ONTOLOGY_ERRORS.ID_CONFLICT);

  const duplicateProperty = clone(knowledgeOntologyFragment);
  duplicateProperty.classes[0].properties.push({ ...duplicateProperty.classes[0].properties[0] });
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: duplicateProperty }]), ONTOLOGY_ERRORS.ID_CONFLICT);

  const crossType = clone(knowledgeOntologyFragment);
  crossType.relations[0].id = 'nc.kb:KnowledgeEntry';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: crossType }]), ONTOLOGY_ERRORS.ID_CONFLICT);

  const duplicateConstraint = clone(knowledgeOntologyFragment);
  duplicateConstraint.constraints.push('KB-C3');
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: duplicateConstraint }]), ONTOLOGY_ERRORS.ID_CONFLICT);
});

test('missing dependencies, unknown requirements and cycles are rejected', () => {
  expectCode(() => new OntologyRegistry().load([{ pluginId: 'knowledge', fragment: knowledgeOntologyFragment }]), ONTOLOGY_ERRORS.DEPENDENCY_UNAVAILABLE);

  const tool = {
    namespace: 'nc.tool:',
    version: '1.0.0',
    apiMajor: 1,
    classes: [{
      id: 'nc.tool:Tool', label: '工具', kind: 'entity', status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    }],
    relations: [],
    constraints: [],
    requires: [{ namespace: 'nc.learn:', major: 1 }],
  };
  const learn = {
    namespace: 'nc.learn:',
    version: '1.0.0',
    apiMajor: 1,
    classes: [{
      id: 'nc.learn:Course', label: '课程', kind: 'entity', status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    }],
    relations: [],
    constraints: [],
    requires: [{ namespace: 'nc.tool:', major: 1 }],
  };
  expectCode(() => new OntologyRegistry().load([
    entries()[0],
    { pluginId: 'enterprise-tools', fragment: tool },
    { pluginId: 'learning', fragment: learn },
  ]), ONTOLOGY_ERRORS.DEPENDENCY_CYCLE);

  const unknown = clone(tool);
  unknown.requires = [{ namespace: 'nc.ext:', major: 1 }];
  expectCode(() => new OntologyRegistry().load([
    entries()[0],
    { pluginId: 'enterprise-tools', fragment: unknown },
  ]), ONTOLOGY_ERRORS.DEPENDENCY_UNAVAILABLE);
});

test('relation endpoints and special relation semantics are enforced', () => {
  const missing = clone(knowledgeOntologyFragment);
  missing.relations[0].from = 'nc.kb:Missing';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: missing }]), ONTOLOGY_ERRORS.REFERENCE_INVALID);

  const supersedes = clone(knowledgeOntologyFragment);
  supersedes.relations[1].from = 'nc.kb:KnowledgeEntry';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: supersedes }]), ONTOLOGY_ERRORS.REFERENCE_INVALID);

  const relatedTo = clone(knowledgeOntologyFragment);
  relatedTo.relations[0].from = 'nc.kb:EntryRevision';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: relatedTo }]), ONTOLOGY_ERRORS.REFERENCE_INVALID);

  const tool = {
    namespace: 'nc.tool:',
    version: '1.0.0',
    apiMajor: 1,
    classes: [{
      id: 'nc.tool:Tool', label: '工具', kind: 'entity', status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    }],
    relations: [],
    constraints: [],
    requires: [{ namespace: 'nc:', major: 1 }],
  };
  const crossNamespace = clone(knowledgeOntologyFragment);
  crossNamespace.relations[0].from = 'nc.tool:Tool';
  expectCode(() => new OntologyRegistry().load([
    entries()[0],
    { pluginId: 'knowledge', fragment: crossNamespace },
    { pluginId: 'enterprise-tools', fragment: tool },
  ]), ONTOLOGY_ERRORS.REFERENCE_INVALID);
});

test('incompatible ontology and api majors are rejected', () => {
  const apiMajor = clone(knowledgeOntologyFragment);
  apiMajor.apiMajor = 2;
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: apiMajor }]), ONTOLOGY_ERRORS.INCOMPATIBLE_VERSION);

  const version = clone(knowledgeOntologyFragment);
  version.version = '2.0.0';
  expectCode(() => new OntologyRegistry().load([entries()[0], { pluginId: 'knowledge', fragment: version }]), ONTOLOGY_ERRORS.INCOMPATIBLE_VERSION);
});

test('reload is idempotent; same version with changed content and namespace removal fail', () => {
  const registry = new OntologyRegistry().load(entries());
  const hash = registry.ontologyHash;
  registry.load(entries());
  assert.equal(registry.ontologyHash, hash);
  assert.equal(registry.history.length, 0);

  const changed = clone(knowledgeOntologyFragment);
  changed.classes[0].label = 'changed label';
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: changed }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);
  assert.equal(registry.ontologyHash, hash);
  assert.equal(registry.getClass('nc.kb:KnowledgeEntry').label, '知识条目');

  expectCode(() => registry.load([entries()[0]]), ONTOLOGY_ERRORS.VERSION_CONFLICT);
});

test('version upgrades and rollbacks are accepted and recorded', () => {
  const registry = new OntologyRegistry().load(entries());
  const original = registry.ontologyHash;
  const upgraded = clone(knowledgeOntologyFragment);
  upgraded.version = '1.1.0';
  registry.load([entries()[0], { pluginId: 'knowledge', fragment: upgraded }]);
  assert.notEqual(registry.ontologyHash, original);
  assert.equal(registry.history.length, 1);
  assert.equal(registry.history[0].direction, 'upgrade');
  assert.equal(registry.history[0].fromVersion, '1.0.0');
  assert.equal(registry.history[0].toVersion, '1.1.0');

  registry.load(entries());
  assert.equal(registry.history.length, 2);
  assert.equal(registry.history[1].direction, 'rollback');
  assert.equal(registry.getNamespace('nc.kb:').version, '1.0.0');
});

test('version upgrades reject removed or tightened structure and allow additive changes', () => {
  const registry = new OntologyRegistry().load(entries());
  const originalHash = registry.ontologyHash;

  const removedClass = clone(knowledgeOntologyFragment);
  removedClass.version = '1.1.0';
  removedClass.classes = removedClass.classes.filter((entry) => entry.id !== 'nc.kb:EntryRevision');
  removedClass.relations = removedClass.relations.filter((entry) => entry.id !== 'nc.kb:supersedes');
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: removedClass }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);
  assert.equal(registry.ontologyHash, originalHash);

  const removedProperty = clone(knowledgeOntologyFragment);
  removedProperty.version = '1.1.0';
  removedProperty.classes[0].properties = [];
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: removedProperty }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const changedType = clone(knowledgeOntologyFragment);
  changedType.version = '1.1.0';
  changedType.classes[0].properties[0].valueType = 'string';
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: changedType }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const requiredAdded = clone(knowledgeOntologyFragment);
  requiredAdded.version = '1.1.0';
  requiredAdded.classes[0].properties.push({ name: 'note', valueType: 'string', required: true });
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: requiredAdded }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const removedRelation = clone(knowledgeOntologyFragment);
  removedRelation.version = '1.1.0';
  removedRelation.relations = removedRelation.relations.filter((entry) => entry.id !== 'nc.kb:supersedes');
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: removedRelation }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const changedDirection = clone(knowledgeOntologyFragment);
  changedDirection.version = '1.1.0';
  changedDirection.relations[0].direction = 'directed';
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: changedDirection }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const removedConstraint = clone(knowledgeOntologyFragment);
  removedConstraint.version = '1.1.0';
  removedConstraint.constraints = ['KB-C4', 'KB-C8'];
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: removedConstraint }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const removedRequirement = clone(knowledgeOntologyFragment);
  removedRequirement.version = '1.1.0';
  removedRequirement.requires = [];
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: removedRequirement }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);

  const additive = clone(knowledgeOntologyFragment);
  additive.version = '1.1.0';
  additive.classes.push({
    id: 'nc.kb:Concept', label: '概念', kind: 'entity', status: 'planned',
    properties: [{ name: 'prefLabel', valueType: 'string', required: true }],
  });
  additive.classes[0].properties.push({ name: 'note', valueType: 'string', required: false });
  additive.relations.push({
    id: 'nc.kb:about', from: 'nc.kb:KnowledgeEntry', to: 'nc.kb:Concept',
    direction: 'directed', evidenceRequired: false, authorizationPropagation: false,
  });
  additive.constraints.push('KB-C5');
  registry.load([entries()[0], { pluginId: 'knowledge', fragment: additive }]);
  assert.equal(registry.getNamespace('nc.kb:').version, '1.1.0');
  assert.equal(registry.getClass('nc.kb:Concept').label, '概念');
  assert.equal(registry.getRelation('nc.kb:about').to, 'nc.kb:Concept');
  assert.deepEqual(registry.listConstraints(), ['KB-C3', 'KB-C4', 'KB-C5', 'KB-C8']);
  assert.equal(registry.history.at(-1).direction, 'upgrade');

  const tightenedAfterAdditive = clone(additive);
  tightenedAfterAdditive.version = '1.2.0';
  tightenedAfterAdditive.classes.find((entry) => entry.id === 'nc.kb:KnowledgeEntry').properties
    .find((property) => property.name === 'note').required = true;
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: tightenedAfterAdditive }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);
  assert.equal(registry.getNamespace('nc.kb:').version, '1.1.0');
});

test('registered version history rejects forged rollback and accepts exact rollback', () => {
  const registry = new OntologyRegistry().load(entries());
  const original = clone(knowledgeOntologyFragment);
  const upgraded = clone(knowledgeOntologyFragment);
  upgraded.version = '1.1.0';
  registry.load([entries()[0], { pluginId: 'knowledge', fragment: upgraded }]);
  const upgradedHash = registry.ontologyHash;
  assert.equal(registry.history.length, 1);

  const forged = clone(original);
  forged.classes[0].label = 'forged rollback';
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: forged }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);
  assert.equal(registry.ontologyHash, upgradedHash);
  assert.equal(registry.history.length, 1);

  registry.load([entries()[0], { pluginId: 'knowledge', fragment: original }]);
  assert.equal(registry.getNamespace('nc.kb:').version, '1.0.0');
  assert.equal(registry.history.length, 2);
  assert.equal(registry.history.at(-1).direction, 'rollback');
  assert.equal(registry.history.at(-1).toVersion, '1.0.0');
});

test('known higher versions cannot bypass compatibility after rollback and intermediate registration', () => {
  const registry = new OntologyRegistry().load(entries());
  const v12 = clone(knowledgeOntologyFragment);
  v12.version = '1.2.0';
  v12.classes[0].properties.push({ name: 'note', valueType: 'string', required: false });
  registry.load([entries()[0], { pluginId: 'knowledge', fragment: v12 }]);

  registry.load(entries());
  const v11 = clone(knowledgeOntologyFragment);
  v11.version = '1.1.0';
  v11.classes[0].properties.push({ name: 'note', valueType: 'integer', required: false });
  registry.load([entries()[0], { pluginId: 'knowledge', fragment: v11 }]);
  const hash = registry.ontologyHash;
  const historyLength = registry.history.length;

  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: v12 }]), ONTOLOGY_ERRORS.VERSION_CONFLICT);
  assert.equal(registry.ontologyHash, hash);
  assert.equal(registry.history.length, historyLength);
  assert.equal(registry.getNamespace('nc.kb:').version, '1.1.0');
  assert.equal(registry.getClass('nc.kb:KnowledgeEntry').properties.find((property) => property.name === 'note').valueType, 'integer');
});

test('exact known rollback and re-upgrade remain allowed', () => {
  const registry = new OntologyRegistry().load(entries());
  const v11 = clone(knowledgeOntologyFragment);
  v11.version = '1.1.0';
  registry.load([entries()[0], { pluginId: 'knowledge', fragment: v11 }]);
  registry.load(entries());
  assert.equal(registry.getNamespace('nc.kb:').version, '1.0.0');
  assert.equal(registry.history.at(-1).direction, 'rollback');

  registry.load([entries()[0], { pluginId: 'knowledge', fragment: v11 }]);
  assert.equal(registry.getNamespace('nc.kb:').version, '1.1.0');
  assert.equal(registry.history.at(-1).direction, 'upgrade');
  assert.equal(registry.history.at(-1).fromVersion, '1.0.0');
});

test('registry construction and empty history are immutable', () => {
  assert.throws(() => new OntologyRegistry({}), TypeError);
  assert.throws(() => new OntologyRegistry({}, []), TypeError);
  const empty = new OntologyRegistry();
  empty.load([]);
  assert.ok(Object.isFrozen(empty.history));
  assert.throws(() => empty.history.push({ namespace: 'forged' }), TypeError);
  assert.equal(empty.history.length, 0);
});

test('a failed load keeps the previous snapshot and history intact', () => {
  const registry = new OntologyRegistry().load(entries());
  const hash = registry.ontologyHash;
  const bad = clone(knowledgeOntologyFragment);
  bad.classes[0].id = 'nc.tool:Foreign';
  expectCode(() => registry.load([entries()[0], { pluginId: 'knowledge', fragment: bad }]), ONTOLOGY_ERRORS.NAMESPACE_CONFLICT);
  assert.equal(registry.ontologyHash, hash);
  assert.equal(registry.getClass('nc.kb:KnowledgeEntry').id, 'nc.kb:KnowledgeEntry');
  assert.equal(registry.history.length, 0);
});

test('tool and learning fragments can declare their own planned classes', () => {
  const tool = {
    namespace: 'nc.tool:',
    version: '1.0.0',
    apiMajor: 1,
    classes: [{
      id: 'nc.tool:Tool', label: '工具', kind: 'entity', status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    }],
    relations: [],
    constraints: [],
    requires: [{ namespace: 'nc:', major: 1 }],
  };
  const learn = {
    namespace: 'nc.learn:',
    version: '1.0.0',
    apiMajor: 1,
    classes: [{
      id: 'nc.learn:Course', label: '课程', kind: 'entity', status: 'planned',
      properties: [{ name: 'id', valueType: 'string', required: true }],
    }],
    relations: [],
    constraints: [],
    requires: [{ namespace: 'nc:', major: 1 }],
  };
  const registry = new OntologyRegistry().load([
    entries()[0],
    { pluginId: 'enterprise-tools', fragment: tool },
    { pluginId: 'learning', fragment: learn },
  ]);
  assert.equal(registry.getClass('nc.tool:Tool').status, 'planned');
  assert.equal(registry.getClass('nc.learn:Course').status, 'planned');
});

test('manifest composition and the command major allowlist stay explicit', () => {
  const manifests = [
    ...foundationManifests.filter((manifest) => manifest.id !== 'knowledge'),
    { id: 'platform', version: '1.0.0', apiMajor: 1, requires: [], commands: [], ontology: platformOntologyFragment },
    { ...foundationManifests.find((manifest) => manifest.id === 'knowledge'), ontology: knowledgeOntologyFragment },
  ];
  assert.equal(ontologyEntriesFromManifests(manifests).length, 2);
  new PluginRegistry(manifests.filter((manifest) => manifest.commands.length === 0 && manifest.id !== 'platform'));

  const withV2 = foundationManifests.map((manifest) => manifest.id === 'knowledge'
    ? { ...manifest, commands: ['knowledge.future.v1', 'knowledge.future.v2'] }
    : manifest);
  assert.doesNotThrow(() => new PluginRegistry(withV2));
  const withV3 = foundationManifests.map((manifest) => manifest.id === 'knowledge'
    ? { ...manifest, commands: ['knowledge.future.v3'] }
    : manifest);
  assert.throws(() => new PluginRegistry(withV3), /COMMAND_NAMESPACE_CONFLICT/);
});
