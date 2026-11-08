// Offline, first-party ontology registry for the knowledge v2 P1 slice.
//
// Input is a static list of trusted plugin manifests or explicit
// {pluginId, fragment} entries. Nothing here reads the filesystem, database,
// Harness, environment or network; input is never executed.
import { canonicalJson, sha256Hex } from './canonical-json.mjs';

export const ONTOLOGY_NAMESPACES = Object.freeze([
  'nc:',
  'nc.org:',
  'nc.access:',
  'nc.kb:',
  'nc.tool:',
  'nc.learn:',
]);

// Fixed first-party ownership. Unknown plugins cannot claim a namespace.
export const ONTOLOGY_NAMESPACE_OWNERS = Object.freeze({
  'nc:': 'platform',
  'nc.org:': 'organization',
  'nc.access:': 'access-management',
  'nc.kb:': 'knowledge',
  'nc.tool:': 'enterprise-tools',
  'nc.learn:': 'learning',
});

export const ONTOLOGY_ERRORS = Object.freeze({
  SCHEMA_INVALID: 'ONTOLOGY_SCHEMA_INVALID',
  NAMESPACE_CONFLICT: 'ONTOLOGY_NAMESPACE_CONFLICT',
  ID_CONFLICT: 'ONTOLOGY_ID_CONFLICT',
  VERSION_CONFLICT: 'ONTOLOGY_VERSION_CONFLICT',
  DEPENDENCY_UNAVAILABLE: 'ONTOLOGY_DEPENDENCY_UNAVAILABLE',
  DEPENDENCY_CYCLE: 'ONTOLOGY_DEPENDENCY_CYCLE',
  REFERENCE_INVALID: 'ONTOLOGY_REFERENCE_INVALID',
  INCOMPATIBLE_VERSION: 'ONTOLOGY_INCOMPATIBLE_VERSION',
});

const CODE = ONTOLOGY_ERRORS;
const CLASS_ID = /^nc(?:\.[a-z]+)?:[A-Za-z][A-Za-z0-9]*$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const CLASS_KEYS = ['id', 'label', 'kind', 'status', 'properties'];
const PROPERTY_KEYS = ['name', 'valueType', 'required'];
const RELATION_KEYS = ['id', 'from', 'to', 'direction', 'evidenceRequired', 'authorizationPropagation'];
const REQUIRED_KEYS = ['namespace', 'version', 'apiMajor', 'classes', 'relations', 'constraints', 'requires'];
const KINDS = new Set(['entity', 'value', 'event']);
const STATUSES = new Set(['planned', 'implemented']);
const VALUE_TYPES = new Set(['string', 'integer', 'boolean', 'datetime', 'hash', 'reference']);
const DIRECTIONS = new Set(['directed', 'symmetric']);
const CONSTRAINTS = new Set(['KB-C1', 'KB-C2', 'KB-C3', 'KB-C4', 'KB-C5', 'KB-C6', 'KB-C7', 'KB-C8', 'KB-C9', 'KB-C10']);

export class OntologyError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'OntologyError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new OntologyError(code, detail);
}

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function assertKeys(value, allowed, label) {
  if (!isPlainObject(value)) fail(CODE.SCHEMA_INVALID, `${label} must be an object`);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) fail(CODE.SCHEMA_INVALID, `${label} has an unexpected field`);
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) fail(CODE.SCHEMA_INVALID, `${label}.${key} is required`);
  }
}

function assertString(value, { min = 0, max = Infinity, label, pattern } = {}) {
  if (typeof value !== 'string') fail(CODE.SCHEMA_INVALID, `${label} must be a string`);
  const length = [...value].length;
  if (length < min || length > max) fail(CODE.SCHEMA_INVALID, `${label} has an invalid length`);
  if (pattern && !pattern.test(value)) fail(CODE.SCHEMA_INVALID, `${label} has an invalid format`);
  return value;
}

function normalizeFragment(fragment) {
  assertKeys(fragment, REQUIRED_KEYS, 'fragment');
  const namespace = fragment.namespace;
  if (typeof namespace !== 'string') fail(CODE.SCHEMA_INVALID, 'namespace must be a string');
  if (!ONTOLOGY_NAMESPACES.includes(namespace)) fail(CODE.NAMESPACE_CONFLICT, 'unknown namespace');
  if (typeof fragment.version !== 'string' || !VERSION.test(fragment.version)) {
    fail(CODE.SCHEMA_INVALID, 'version must be strict semver');
  }
  if (Number(fragment.version.split('.')[0]) !== 1) {
    fail(CODE.INCOMPATIBLE_VERSION, 'ontology major must be 1');
  }
  if (fragment.apiMajor !== 1) {
    fail(typeof fragment.apiMajor === 'number' ? CODE.INCOMPATIBLE_VERSION : CODE.SCHEMA_INVALID,
      'apiMajor must be 1');
  }

  if (!Array.isArray(fragment.classes) || fragment.classes.length < 1 || fragment.classes.length > 64) {
    fail(CODE.SCHEMA_INVALID, 'classes must contain 1..64 items');
  }
  if (!Array.isArray(fragment.relations) || fragment.relations.length > 64) {
    fail(CODE.SCHEMA_INVALID, 'relations must contain 0..64 items');
  }
  if (!Array.isArray(fragment.constraints) || fragment.constraints.length > 10) {
    fail(CODE.SCHEMA_INVALID, 'constraints must contain 0..10 items');
  }
  if (!Array.isArray(fragment.requires) || fragment.requires.length > 8) {
    fail(CODE.SCHEMA_INVALID, 'requires must contain 0..8 items');
  }

  const classes = fragment.classes.map((entry) => {
    assertKeys(entry, CLASS_KEYS, 'class');
    assertString(entry.id, { min: 1, label: 'class.id', pattern: CLASS_ID });
    assertString(entry.label, { min: 1, max: 80, label: 'class.label' });
    if (!KINDS.has(entry.kind)) fail(CODE.SCHEMA_INVALID, 'class.kind is invalid');
    if (!STATUSES.has(entry.status)) fail(CODE.SCHEMA_INVALID, 'class.status is invalid');
    if (!Array.isArray(entry.properties) || entry.properties.length > 64) {
      fail(CODE.SCHEMA_INVALID, 'class.properties must contain 0..64 items');
    }
    const properties = entry.properties.map((property) => {
      assertKeys(property, PROPERTY_KEYS, 'property');
      assertString(property.name, { min: 1, max: 64, label: 'property.name' });
      if (!VALUE_TYPES.has(property.valueType)) fail(CODE.SCHEMA_INVALID, 'property.valueType is invalid');
      if (typeof property.required !== 'boolean') fail(CODE.SCHEMA_INVALID, 'property.required must be boolean');
      return { name: property.name, valueType: property.valueType, required: property.required };
    }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return {
      id: entry.id,
      label: entry.label,
      kind: entry.kind,
      status: entry.status,
      properties,
    };
  }).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const relations = fragment.relations.map((entry) => {
    assertKeys(entry, RELATION_KEYS, 'relation');
    assertString(entry.id, { min: 1, label: 'relation.id', pattern: CLASS_ID });
    assertString(entry.from, { min: 1, label: 'relation.from', pattern: CLASS_ID });
    assertString(entry.to, { min: 1, label: 'relation.to', pattern: CLASS_ID });
    if (!DIRECTIONS.has(entry.direction)) fail(CODE.SCHEMA_INVALID, 'relation.direction is invalid');
    if (typeof entry.evidenceRequired !== 'boolean') fail(CODE.SCHEMA_INVALID, 'relation.evidenceRequired must be boolean');
    if (entry.authorizationPropagation !== false) {
      fail(CODE.SCHEMA_INVALID, 'authorizationPropagation must be false');
    }
    return {
      id: entry.id,
      from: entry.from,
      to: entry.to,
      direction: entry.direction,
      evidenceRequired: entry.evidenceRequired,
      authorizationPropagation: false,
    };
  }).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const constraints = fragment.constraints.map((constraint) => {
    if (typeof constraint !== 'string' || !CONSTRAINTS.has(constraint)) {
      fail(CODE.SCHEMA_INVALID, 'constraint id is invalid');
    }
    return constraint;
  }).sort();

  const requires = fragment.requires.map((requirement) => {
    assertKeys(requirement, ['namespace', 'major'], 'requires');
    assertString(requirement.namespace, { min: 1, max: 32, label: 'requires.namespace' });
    if (!Number.isInteger(requirement.major) || requirement.major !== 1) {
      fail(CODE.SCHEMA_INVALID, 'requires.major must be 1');
    }
    return { namespace: requirement.namespace, major: requirement.major };
  }).sort((a, b) => (a.namespace < b.namespace ? -1 : a.namespace > b.namespace ? 1 : 0));
  const requiresNamespaces = new Set();
  for (const requirement of requires) {
    if (requiresNamespaces.has(requirement.namespace)) fail(CODE.ID_CONFLICT, `duplicate requirement ${requirement.namespace}`);
    requiresNamespaces.add(requirement.namespace);
  }

  // Structural uniqueness is checked before aggregation so the registry can
  // reject ambiguous metadata before publishing any partial snapshot.
  const classIds = new Set();
  for (const entry of classes) {
    if (classIds.has(entry.id)) fail(CODE.ID_CONFLICT, `duplicate class ${entry.id}`);
    classIds.add(entry.id);
    const propertyNames = new Set();
    for (const property of entry.properties) {
      if (propertyNames.has(property.name)) fail(CODE.ID_CONFLICT, `duplicate property ${entry.id}.${property.name}`);
      propertyNames.add(property.name);
    }
  }
  const relationIds = new Set();
  for (const entry of relations) {
    if (relationIds.has(entry.id) || classIds.has(entry.id)) fail(CODE.ID_CONFLICT, `duplicate relation ${entry.id}`);
    relationIds.add(entry.id);
  }
  if (new Set(constraints).size !== constraints.length) fail(CODE.ID_CONFLICT, 'duplicate constraint');

  for (const entry of [...classes, ...relations]) {
    if (!entry.id.startsWith(namespace)) fail(CODE.NAMESPACE_CONFLICT, `id ${entry.id} is outside ${namespace}`);
  }

  const normalized = {
    namespace,
    version: fragment.version,
    apiMajor: 1,
    classes,
    relations,
    constraints,
    requires,
  };
  return { ...normalized, fragmentHash: sha256Hex(canonicalJson(normalized)) };
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) fail(CODE.SCHEMA_INVALID, 'entries must be an array');
  return entries.map((entry) => {
    if (!isPlainObject(entry)) fail(CODE.SCHEMA_INVALID, 'entry must be an object');
    let pluginId;
    let fragment;
    if (Object.hasOwn(entry, 'pluginId') && Object.hasOwn(entry, 'fragment')) {
      if (Object.keys(entry).some((key) => !['pluginId', 'fragment'].includes(key))) {
        fail(CODE.SCHEMA_INVALID, 'entry has an unexpected field');
      }
      pluginId = entry.pluginId;
      fragment = entry.fragment;
    } else if (Object.hasOwn(entry, 'id') && Object.hasOwn(entry, 'ontology')) {
      // Full plugin manifests may carry lifecycle/command metadata; only the
      // ontology fragment is schema-checked here.
      pluginId = entry.id;
      fragment = entry.ontology;
    } else {
      fail(CODE.SCHEMA_INVALID, 'entry must be {pluginId, fragment} or {id, ontology}');
    }
    if (!isPlainObject(fragment)) fail(CODE.SCHEMA_INVALID, 'fragment must be an object');
    if (typeof pluginId !== 'string' || !Object.hasOwn(ONTOLOGY_NAMESPACE_OWNERS, fragment.namespace ?? '')) {
      fail(CODE.NAMESPACE_CONFLICT, 'unknown plugin or namespace');
    }
    if (ONTOLOGY_NAMESPACE_OWNERS[fragment.namespace] !== pluginId) {
      fail(CODE.NAMESPACE_CONFLICT, `${pluginId} does not own ${fragment.namespace}`);
    }
    return normalizeFragment(fragment);
  });
}

function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function assertDependencies(fragments) {
  const byNamespace = new Map(fragments.map((fragment) => [fragment.namespace, fragment]));
  for (const fragment of fragments) {
    for (const requirement of fragment.requires) {
      if (!ONTOLOGY_NAMESPACES.includes(requirement.namespace) || !byNamespace.has(requirement.namespace)) {
        fail(CODE.DEPENDENCY_UNAVAILABLE, `${fragment.namespace} requires ${requirement.namespace}`);
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (namespace, path) => {
    if (visiting.has(namespace)) fail(CODE.DEPENDENCY_CYCLE, `${[...path, namespace].join(' -> ')}`);
    if (visited.has(namespace)) return;
    visiting.add(namespace);
    for (const requirement of byNamespace.get(namespace).requires) visit(requirement.namespace, [...path, namespace]);
    visiting.delete(namespace);
    visited.add(namespace);
  };
  for (const namespace of byNamespace.keys()) visit(namespace, []);
}

function assertRelationReferences(fragments, classes) {
  const classMap = new Map(classes.map((entry) => [entry.id, entry]));
  for (const fragment of fragments) {
    const allowed = new Set([fragment.namespace, ...fragment.requires.map((requirement) => requirement.namespace)]);
    for (const relation of fragment.relations) {
      for (const endpoint of [relation.from, relation.to]) {
        if (!classMap.has(endpoint)) fail(CODE.REFERENCE_INVALID, `${relation.id} references missing ${endpoint}`);
        if (!allowed.has(endpoint.split(':')[0] + ':')) fail(CODE.REFERENCE_INVALID, `${relation.id} references unauthorized ${endpoint}`);
      }
      if (relation.id === 'nc.kb:supersedes' &&
          (relation.from !== 'nc.kb:EntryRevision' || relation.to !== 'nc.kb:EntryRevision')) {
        fail(CODE.REFERENCE_INVALID, 'supersedes must connect EntryRevision revisions');
      }
      if ((relation.id === 'nc.kb:relatedTo' || relation.id === 'nc.kb:conflictsWith') &&
          (relation.from !== 'nc.kb:KnowledgeEntry' || relation.to !== 'nc.kb:KnowledgeEntry')) {
        fail(CODE.REFERENCE_INVALID, `${relation.id} must connect KnowledgeEntry entries`);
      }
    }
  }
}

const EMPTY = Object.freeze({
  namespaces: Object.freeze([]),
  classes: Object.freeze([]),
  relations: Object.freeze([]),
  constraints: Object.freeze([]),
  ontologyHash: sha256Hex(canonicalJson({
    namespaces: [],
    classes: [],
    relations: [],
    constraints: [],
  })),
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function build(entries, previous, previousHistory) {
  const normalized = normalizeEntries(entries);
  if (normalized.length === 0) {
    if (previous.namespaces.length > 0) fail(CODE.VERSION_CONFLICT, 'cannot remove registered namespaces');
    return { snapshot: EMPTY, history: previousHistory };
  }

  const byNamespace = new Map();
  for (const fragment of normalized) {
    const existing = byNamespace.get(fragment.namespace);
    if (existing) {
      if (existing.fragmentHash !== fragment.fragmentHash) fail(CODE.VERSION_CONFLICT, `conflicting fragments for ${fragment.namespace}`);
      continue;
    }
    byNamespace.set(fragment.namespace, fragment);
  }
  const fragments = [...byNamespace.values()];
  assertDependencies(fragments);

  // Version reconciliation against the previous snapshot. A same-version
  // reload is idempotent only when its canonical content is identical.
  const history = [...previousHistory];
  for (const fragment of fragments) {
    const prior = previous.namespaces.find((entry) => entry.namespace === fragment.namespace);
    if (!prior) {
      if (previous.namespaces.length > 0) {
        history.push({
          namespace: fragment.namespace,
          fromVersion: null,
          toVersion: fragment.version,
          fromHash: null,
          toHash: fragment.fragmentHash,
          direction: 'initial',
        });
      }
      continue;
    }
    if (prior.version === fragment.version) {
      if (prior.fragmentHash !== fragment.fragmentHash) {
        fail(CODE.VERSION_CONFLICT, `${fragment.namespace}@${fragment.version} changed content`);
      }
      continue;
    }
    history.push({
      namespace: fragment.namespace,
      fromVersion: prior.version,
      toVersion: fragment.version,
      fromHash: prior.fragmentHash,
      toHash: fragment.fragmentHash,
      direction: compareVersions(fragment.version, prior.version) > 0 ? 'upgrade' : 'rollback',
    });
  }
  for (const prior of previous.namespaces) {
    if (!byNamespace.has(prior.namespace)) fail(CODE.VERSION_CONFLICT, `cannot remove ${prior.namespace}`);
  }

  const classes = [];
  const relations = [];
  const constraints = new Set();
  const classIds = new Set();
  const relationIds = new Set();
  for (const fragment of fragments) {
    for (const entry of fragment.classes) {
      if (classIds.has(entry.id) || relationIds.has(entry.id)) fail(CODE.ID_CONFLICT, `duplicate id ${entry.id}`);
      classIds.add(entry.id);
      classes.push(entry);
    }
    for (const entry of fragment.relations) {
      if (classIds.has(entry.id) || relationIds.has(entry.id)) fail(CODE.ID_CONFLICT, `duplicate id ${entry.id}`);
      relationIds.add(entry.id);
      relations.push(entry);
    }
    for (const constraint of fragment.constraints) {
      if (constraints.has(constraint)) fail(CODE.ID_CONFLICT, `duplicate constraint ${constraint}`);
      constraints.add(constraint);
    }
  }
  classes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  relations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  assertRelationReferences(fragments, classes);

  const namespaces = fragments.map((fragment) => ({
    namespace: fragment.namespace,
    version: fragment.version,
    apiMajor: 1,
    requires: fragment.requires,
    fragmentHash: fragment.fragmentHash,
  })).sort((a, b) => (a.namespace < b.namespace ? -1 : a.namespace > b.namespace ? 1 : 0));
  const payload = {
    namespaces,
    classes,
    relations,
    constraints: [...constraints].sort(),
  };
  const snapshot = deepFreeze({ ...payload, ontologyHash: sha256Hex(canonicalJson(payload)) });
  return { snapshot, history: deepFreeze(history) };
}

export class OntologyRegistry {
  #snapshot;
  #history;

  constructor(snapshot = EMPTY, history = []) {
    this.#snapshot = snapshot;
    this.#history = history;
  }

  static load(entries, options = {}) {
    const registry = new OntologyRegistry();
    registry.load(entries, options);
    return registry;
  }

  load(entries, options = {}) {
    const logger = typeof options.logger === 'function' ? options.logger : null;
    let next;
    try {
      next = build(entries, this.#snapshot, this.#history);
    } catch (error) {
      if (logger) {
        try { logger({ code: error.code ?? 'ONTOLOGY_LOAD_FAILED' }); } catch { /* logging must not affect registry state */ }
      }
      throw error;
    }
    this.#snapshot = next.snapshot;
    this.#history = next.history;
    if (logger) {
      for (const namespace of next.snapshot.namespaces) {
        try { logger({ namespace: namespace.namespace, version: namespace.version, hash: namespace.fragmentHash, code: 'OK' }); } catch { /* logging must not affect registry state */ }
      }
    }
    return this;
  }

  get snapshot() {
    return this.#snapshot;
  }

  get ontologyHash() {
    return this.#snapshot.ontologyHash;
  }

  get history() {
    return this.#history;
  }

  getNamespace(namespace) {
    return this.#snapshot.namespaces.find((entry) => entry.namespace === namespace) ?? null;
  }

  getClass(id) {
    return this.#snapshot.classes.find((entry) => entry.id === id) ?? null;
  }

  getRelation(id) {
    return this.#snapshot.relations.find((entry) => entry.id === id) ?? null;
  }

  listNamespaces() {
    return this.#snapshot.namespaces;
  }

  listClasses() {
    return this.#snapshot.classes;
  }

  listRelations() {
    return this.#snapshot.relations;
  }

  listConstraints() {
    return this.#snapshot.constraints;
  }
}

export function loadOntology(entries) {
  return OntologyRegistry.load(entries).snapshot;
}

export function ontologyEntriesFromManifests(manifests) {
  if (!Array.isArray(manifests)) fail(CODE.SCHEMA_INVALID, 'manifests must be an array');
  return manifests
    .filter((manifest) => manifest && Object.hasOwn(manifest, 'ontology'))
    .map((manifest) => ({ pluginId: manifest.id, fragment: manifest.ontology }));
}
