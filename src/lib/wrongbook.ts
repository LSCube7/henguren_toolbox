import type { WrongBookAttempt, WrongBookRecord, WrongBookSnapshot, WrongBookTombstone } from "./types";
import type { MasteryRecord } from "./mastery";

type WrongBookIdentity = Partial<Pick<WrongBookRecord, "sourceName" | "word">>;
type SynthesizedAttemptIdentity = readonly ["test", string] | readonly ["count", number];

function recordId(record: Partial<WrongBookRecord>) {
  return String(record.id || wrongBookRecordId(record)).toLowerCase();
}

function recordIdentity(record: WrongBookIdentity) {
  return [
    String(record.sourceName ?? "custom").toLowerCase(),
    String(record.word ?? "unknown").toLowerCase()
  ] as const;
}

export function legacyWrongBookRecordId(record: WrongBookIdentity) {
  return recordIdentity(record).join(":");
}

export function wrongBookRecordId(record: WrongBookIdentity) {
  const identity = recordIdentity(record);
  if (identity.every((value) => !value.includes(":"))) return legacyWrongBookRecordId(record);
  return `tuple-v1:${JSON.stringify(identity)}`;
}

function recordKey(record: WrongBookIdentity) {
  return JSON.stringify(recordIdentity(record));
}

function recordIdAliases(record: Partial<WrongBookRecord>) {
  const aliases = Array.isArray(record.aliases) ? record.aliases : [];
  return Array.from(new Set([
    recordId(record),
    ...aliases.map((alias) => String(alias).toLowerCase()),
    legacyWrongBookRecordId(record),
    wrongBookRecordId(record)
  ].filter(Boolean)));
}

function tupleRecordIdentity(id: string): WrongBookIdentity | null {
  if (!id.startsWith("tuple-v1:")) return null;
  try {
    const value = JSON.parse(id.slice("tuple-v1:".length)) as unknown;
    if (!Array.isArray(value) || value.length !== 2 || value.some((part) => typeof part !== "string")) return null;
    return { sourceName: value[0], word: value[1] };
  } catch {
    return null;
  }
}

function storedCanonicalRecordId(tombstone: WrongBookTombstone) {
  if (tombstone.canonicalRecordId === tombstone.id) return tombstone.id;
  const identity = tupleRecordIdentity(tombstone.id);
  if (identity) return wrongBookRecordId(identity);
  return null;
}

function tombstoneIdAliases(tombstone: WrongBookTombstone) {
  const identity = tupleRecordIdentity(tombstone.id);
  return Array.from(new Set([
    tombstone.id,
    ...(tombstone.aliases ?? []),
    ...(identity ? [legacyWrongBookRecordId(identity), wrongBookRecordId(identity)] : [])
  ].map((alias) => alias.toLowerCase()).filter(Boolean)));
}

function encodedSynthesizedAttemptId(recordId: string, identity: SynthesizedAttemptIdentity) {
  return `legacy-v2:${JSON.stringify([recordId, ...identity])}`;
}

function synthesizedAttemptIdentity(record: Partial<WrongBookRecord>, attempt: WrongBookAttempt): SynthesizedAttemptIdentity | null {
  if (attempt.clientId !== "legacy") return null;
  const aliases = recordIdAliases(record);
  if (attempt.id.startsWith("legacy-v2:")) {
    try {
      const value = JSON.parse(attempt.id.slice("legacy-v2:".length)) as unknown;
      if (!Array.isArray(value) || value.length !== 3 || !aliases.includes(String(value[0]).toLowerCase())) return null;
      if (value[1] === "test" && typeof value[2] === "string") return ["test", value[2]];
      if (value[1] === "count" && Number.isInteger(value[2]) && Number(value[2]) > 0) return ["count", Number(value[2])];
    } catch {
      return null;
    }
    return null;
  }

  for (const alias of aliases.sort((left, right) => right.length - left.length)) {
    const prefix = `legacy:${alias}:`;
    if (!attempt.id.startsWith(prefix)) continue;
    const suffix = attempt.id.slice(prefix.length);
    if (attempt.testNo && suffix === attempt.testNo) return ["test", attempt.testNo];
    const count = /^count:(\d+)$/.exec(suffix)?.[1];
    if (count && Number(count) > 0) return ["count", Number(count)];
  }
  return null;
}

function equivalentSynthesizedAttemptIds(record: Partial<WrongBookRecord>, attempt: WrongBookAttempt) {
  const identity = synthesizedAttemptIdentity(record, attempt);
  if (!identity) return new Set([attempt.id]);
  return new Set(recordIdAliases(record).flatMap((alias) => [
    encodedSynthesizedAttemptId(alias, identity),
    identity[0] === "test" ? `legacy:${alias}:${identity[1]}` : `legacy:${alias}:count:${identity[1]}`
  ]));
}

export function planMasteryRecordIdMigrations(
  records: WrongBookRecord[],
  masteryById: Record<string, MasteryRecord>,
  deletedRecords: WrongBookTombstone[] = []
) {
  const targetsByAlias = new Map<string, Set<string>>();
  const addAliasTarget = (alias: string, target: string) => {
    const targets = targetsByAlias.get(alias) ?? new Set<string>();
    targets.add(target);
    targetsByAlias.set(alias, targets);
  };
  records.forEach((record) => {
    const canonicalId = wrongBookRecordId(record);
    recordIdAliases(record).forEach((alias) => addAliasTarget(alias, canonicalId));
  });
  deletedRecords.forEach((tombstone) => {
    const canonicalId = storedCanonicalRecordId(tombstone) ?? tombstone.id;
    tombstoneIdAliases(tombstone).forEach((alias) => addAliasTarget(alias, canonicalId));
  });

  const aliasesByCanonicalId = new Map<string, string[]>();
  targetsByAlias.forEach((targets, alias) => {
    if (targets.size !== 1 || !masteryById[alias]) return;
    const [canonicalId] = targets;
    if (!canonicalId || alias === canonicalId) return;
    aliasesByCanonicalId.set(canonicalId, [...(aliasesByCanonicalId.get(canonicalId) ?? []), alias]);
  });

  return Array.from(aliasesByCanonicalId).flatMap(([canonicalId, aliases]) => {
    const candidates = [masteryById[canonicalId], ...aliases.map((alias) => masteryById[alias])]
      .filter((record): record is MasteryRecord => Boolean(record));
    const newest = candidates.reduce((current, candidate) => (
      candidate.updatedAt > current.updatedAt ? candidate : current
    ));
    const canonicalRecord = { ...newest, id: canonicalId };
    return aliases.map((legacyId) => ({ legacyId, canonicalId, record: canonicalRecord }));
  });
}

function uniqueStrings(values: unknown) {
  return Array.isArray(values) ? Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))) : [];
}

function legacyDeletionCutoffs(tombstone: WrongBookTombstone) {
  const cutoffs = new Map<string, string>();
  Object.entries(tombstone.legacyDeletionCutoffs ?? {}).forEach(([clientId, deletedAt]) => {
    if (clientId && deletedAt) cutoffs.set(clientId, deletedAt);
  });
  const legacyDeletedAt = tombstone.legacyDeletedAt ?? (Array.isArray(tombstone.deletedAttemptIds) ? undefined : tombstone.deletedAt);
  if (legacyDeletedAt) {
    const existing = cutoffs.get(tombstone.clientId);
    if (!existing || legacyDeletedAt > existing) cutoffs.set(tombstone.clientId, legacyDeletedAt);
  }
  return cutoffs;
}

function mergeLegacyDeletionCutoffs(...tombstones: WrongBookTombstone[]) {
  const merged = new Map<string, string>();
  tombstones.forEach((tombstone) => {
    legacyDeletionCutoffs(tombstone).forEach((deletedAt, clientId) => {
      const existing = merged.get(clientId);
      if (!existing || deletedAt > existing) merged.set(clientId, deletedAt);
    });
  });
  return Object.fromEntries(merged);
}

function isAttemptDeleted(attempt: WrongBookAttempt, tombstone: WrongBookTombstone | undefined, record: WrongBookRecord) {
  if (!tombstone) return false;
  const equivalentIds = equivalentSynthesizedAttemptIds(record, attempt);
  if (tombstone.deletedAttemptIds?.some((id) => equivalentIds.has(id))) return true;
  const cutoffs = legacyDeletionCutoffs(tombstone);
  const legacyCutoff = attempt.clientId === "legacy"
    ? Array.from(cutoffs.values()).sort().at(-1)
    : cutoffs.get(attempt.clientId);
  if (!legacyCutoff) return false;
  return attempt.createdAt < legacyCutoff;
}

export function mergeWrongBookTombstones(values: WrongBookTombstone[]) {
  const tombstones = new Map<string, WrongBookTombstone>();
  values.forEach((value) => {
    const existing = tombstones.get(value.id);
    if (!existing) {
      tombstones.set(value.id, value);
      return;
    }
    const newest = existing.deletedAt >= value.deletedAt ? existing : value;
    const hasObservedAttempts = Array.isArray(existing.deletedAttemptIds) || Array.isArray(value.deletedAttemptIds);
    const aliases = uniqueStrings([...(existing.aliases ?? []), ...(value.aliases ?? [])])
      .filter((alias) => alias !== newest.id);
    tombstones.set(value.id, {
      ...newest,
      canonicalRecordId: newest.canonicalRecordId ?? existing.canonicalRecordId ?? value.canonicalRecordId,
      aliases: aliases.length > 0 ? aliases : undefined,
      deletedAttemptIds: hasObservedAttempts
        ? uniqueStrings([...(existing.deletedAttemptIds ?? []), ...(value.deletedAttemptIds ?? [])])
        : undefined,
      legacyDeletionCutoffs: mergeLegacyDeletionCutoffs(existing, value),
      legacyDeletedAt: undefined
    });
  });
  return Array.from(tombstones.values());
}

function normalizeTombstones(values: unknown, normalizeId: (id: string) => string): WrongBookTombstone[] {
  if (!Array.isArray(values)) return [];
  return mergeWrongBookTombstones(
    values
      .filter((value): value is Partial<WrongBookTombstone> => Boolean(value && typeof value === "object"))
      .map((value) => {
        const id = normalizeId(String(value.id ?? ""));
        const deletedAt = String(value.deletedAt ?? new Date(0).toISOString());
        const hasObservedAttempts = Array.isArray(value.deletedAttemptIds);
        const aliases = uniqueStrings(value.aliases).map(normalizeId).filter((alias) => alias !== id);
        const canonicalRecordId = value.canonicalRecordId
          ? normalizeId(String(value.canonicalRecordId))
          : undefined;
        return {
          id,
          canonicalRecordId: canonicalRecordId === id ? canonicalRecordId : undefined,
          aliases: aliases.length > 0 ? aliases : undefined,
          clientId: String(value.clientId ?? "legacy"),
          deletedAt,
          deletedAttemptIds: hasObservedAttempts ? uniqueStrings(value.deletedAttemptIds) : undefined,
          legacyDeletionCutoffs: mergeLegacyDeletionCutoffs({
            id: String(value.id ?? ""),
            clientId: String(value.clientId ?? "legacy"),
            deletedAt,
            deletedAttemptIds: hasObservedAttempts ? uniqueStrings(value.deletedAttemptIds) : undefined,
            legacyDeletionCutoffs: value.legacyDeletionCutoffs,
            legacyDeletedAt: value.legacyDeletedAt ? String(value.legacyDeletedAt) : undefined
          })
        };
      })
      .filter((value) => value.id.length > 0)
  );
}

function normalizeAttempts(record: Partial<WrongBookRecord>) {
  const synthesisId = wrongBookRecordId(record);
  const synthesizedId = (identity: SynthesizedAttemptIdentity) => encodedSynthesizedAttemptId(synthesisId, identity);
  const attempts = new Map<string, WrongBookAttempt>();
  const synthesizedAttemptIds = new Set<string>();
  const legacyAttemptCreatedAt = String(record.createdAt ?? new Date(0).toISOString());
  const legacyAttemptUpdatedAt = String(record.updatedAt ?? record.createdAt ?? new Date(0).toISOString());
  if (Array.isArray(record.wrongAttempts)) {
    record.wrongAttempts.forEach((attempt) => {
      if (!attempt || typeof attempt !== "object") return;
      const attemptId = String(attempt.id ?? "");
      if (!attemptId) return;
      attempts.set(attemptId, {
        id: attemptId,
        testNo: attempt.testNo ? String(attempt.testNo) : undefined,
        batchName: attempt.batchName ? String(attempt.batchName) : undefined,
        clientId: String(attempt.clientId ?? "legacy"),
        createdAt: String(attempt.createdAt ?? legacyAttemptCreatedAt)
      });
      if (!attempt.createdAt) synthesizedAttemptIds.add(attemptId);
    });
  }

  const legacyTestNos = uniqueStrings(record.testNos);
  const legacyBatchNames = uniqueStrings(record.batchNames);
  if (attempts.size === 0) {
    legacyTestNos.forEach((testNo, index) => {
      const attemptId = synthesizedId(["test", testNo]);
      attempts.set(attemptId, {
        id: attemptId,
        testNo,
        batchName: legacyBatchNames[index] ?? legacyBatchNames[0],
        clientId: "legacy",
        createdAt: legacyAttemptCreatedAt
      });
      synthesizedAttemptIds.add(attemptId);
    });
  }

  const legacyWrongCount = Math.max(0, Number(record.wrongCount) || 0);
  const fallbackLegacyAttempt = Array.from(attempts.values()).find((attempt) => attempt.testNo);
  for (let index = attempts.size; index < legacyWrongCount; index += 1) {
    const attemptId = synthesizedId(["count", index + 1]);
    attempts.set(attemptId, {
      id: attemptId,
      testNo: fallbackLegacyAttempt?.testNo,
      batchName: fallbackLegacyAttempt?.batchName,
      clientId: "legacy",
      createdAt: legacyAttemptCreatedAt
    });
    synthesizedAttemptIds.add(attemptId);
  }
  const latestSynthesizedAttemptId = Array.from(synthesizedAttemptIds).at(-1);
  if (latestSynthesizedAttemptId) {
    const latestAttempt = attempts.get(latestSynthesizedAttemptId);
    if (latestAttempt) attempts.set(latestSynthesizedAttemptId, { ...latestAttempt, createdAt: legacyAttemptUpdatedAt });
  }
  return Array.from(attempts.values());
}

function normalizeRecord(record: Partial<WrongBookRecord>): WrongBookRecord {
  const id = recordId(record);
  const aliases = Array.isArray(record.aliases)
    ? Array.from(new Set(record.aliases.map((alias) => String(alias).toLowerCase()).filter((alias) => alias && alias !== id)))
    : [];
  const attempts = normalizeAttempts(record);
  return {
    id,
    aliases: aliases.length > 0 ? aliases : undefined,
    word: String(record.word ?? ""),
    sourceName: String(record.sourceName ?? "custom"),
    sourceTitle: record.sourceTitle ? String(record.sourceTitle) : undefined,
    definitions: uniqueStrings(record.definitions),
    zhDefinitions: uniqueStrings(record.zhDefinitions),
    wrongCount: attempts.length,
    wrongAttempts: attempts,
    testNos: Array.from(new Set(attempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
    batchNames: Array.from(new Set(attempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString())
  };
}

function mergeRecords(existing: WrongBookRecord, incoming: WrongBookRecord) {
  const newest = existing.updatedAt >= incoming.updatedAt ? existing : incoming;
  const canonicalId = wrongBookRecordId(newest);
  const attempts = new Map<string, WrongBookAttempt>();
  ([existing, incoming] as const).forEach((record) => {
    (record.wrongAttempts ?? []).forEach((attempt) => {
      const identity = synthesizedAttemptIdentity(record, attempt);
      const key = identity ? `synthesized:${JSON.stringify(identity)}` : `id:${attempt.id}`;
      const current = attempts.get(key);
      if (!current || attempt.createdAt > current.createdAt) {
        attempts.set(key, identity ? { ...attempt, id: encodedSynthesizedAttemptId(canonicalId, identity) } : attempt);
      }
    });
  });
  const wrongAttempts = Array.from(attempts.values());
  const aliases = Array.from(new Set([...recordIdAliases(existing), ...recordIdAliases(incoming)]))
    .filter((alias) => alias !== canonicalId);
  return {
    ...existing,
    ...newest,
    id: canonicalId,
    aliases: aliases.length > 0 ? aliases : undefined,
    definitions: Array.from(new Set([...(existing.definitions ?? []), ...(incoming.definitions ?? [])])),
    zhDefinitions: Array.from(new Set([...(existing.zhDefinitions ?? []), ...(incoming.zhDefinitions ?? [])])),
    wrongCount: wrongAttempts.length,
    wrongAttempts,
    testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
    batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
    createdAt: existing.createdAt < incoming.createdAt ? existing.createdAt : incoming.createdAt,
    updatedAt: existing.updatedAt > incoming.updatedAt ? existing.updatedAt : incoming.updatedAt
  } satisfies WrongBookRecord;
}

function applyTombstones(records: WrongBookRecord[], deletedRecords: WrongBookTombstone[], deletedBatches: WrongBookTombstone[]) {
  const recordDeletes = new Map(deletedRecords.map((tombstone) => [tombstone.id, tombstone]));
  const batchDeletes = new Map(deletedBatches.map((tombstone) => [tombstone.id, tombstone]));
  return records.flatMap((record) => {
    const recordDelete = recordDeletes.get(record.id);
    const attemptsAfterRecordDelete = (record.wrongAttempts ?? []).filter((attempt) => !isAttemptDeleted(attempt, recordDelete, record));
    const wrongAttempts = attemptsAfterRecordDelete.filter((attempt) => {
      if (!attempt.testNo) return true;
      return !isAttemptDeleted(attempt, batchDeletes.get(attempt.testNo), record);
    });
    if (wrongAttempts.length === 0) return [];
    return [{
      ...record,
      wrongCount: wrongAttempts.length,
      wrongAttempts,
      testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
      batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : []))))
    }];
  });
}

export function removeWrongBookBatchAttempts(records: WrongBookRecord[], testNo: string, updatedAt: string) {
  const removedRecordIds: string[] = [];
  const deletedAttemptIds = records.flatMap((record) =>
    (record.wrongAttempts ?? []).filter((attempt) => attempt.testNo === testNo).map((attempt) => attempt.id)
  );
  const remainingRecords = records.flatMap((record) => {
    const currentAttempts = record.wrongAttempts ?? [];
    const wrongAttempts = currentAttempts.filter((attempt) => attempt.testNo !== testNo);
    if (wrongAttempts.length === 0) {
      if (currentAttempts.some((attempt) => attempt.testNo === testNo)) removedRecordIds.push(record.id);
      return [];
    }
    if (wrongAttempts.length === currentAttempts.length) return [record];
    return [{
      ...record,
      wrongCount: wrongAttempts.length,
      wrongAttempts,
      testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
      batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
      updatedAt
    }];
  });
  return { records: remainingRecords, removedRecordIds, deletedAttemptIds };
}

export function removeWrongBookRecord(records: WrongBookRecord[], id: string) {
  const requestedId = id.toLowerCase();
  const exactRecord = records.find((record) => recordId(record) === requestedId);
  const candidates = exactRecord
    ? [exactRecord]
    : records.filter((record) => recordIdAliases(record).includes(requestedId));
  const candidateKeys = new Set(candidates.map(recordKey));

  if (candidateKeys.size !== 1) {
    return {
      records,
      deletedRecordId: requestedId,
      canonicalRecordId: undefined,
      aliases: [] as string[],
      deletedAttemptIds: [] as string[],
      removedRecordIds: [] as string[],
      masteryRecordIds: [] as string[]
    };
  }

  const [targetKey] = candidateKeys;
  const deletedRecords = records.filter((record) => recordKey(record) === targetKey);
  const remainingRecords = records.filter((record) => recordKey(record) !== targetKey);
  const canonicalRecordId = wrongBookRecordId(deletedRecords[0]);
  const deletedAliases = Array.from(new Set(deletedRecords.flatMap(recordIdAliases)));
  const remainingAliases = new Set(remainingRecords.flatMap(recordIdAliases));
  const removedRecordIds = Array.from(new Set(deletedRecords.map(recordId)));

  return {
    records: remainingRecords,
    deletedRecordId: canonicalRecordId,
    canonicalRecordId,
    aliases: deletedAliases.filter((alias) => alias !== canonicalRecordId),
    deletedAttemptIds: uniqueStrings(deletedRecords.flatMap((record) => (
      (record.wrongAttempts ?? []).map((attempt) => attempt.id)
    ))),
    removedRecordIds,
    masteryRecordIds: removedRecordIds.filter((recordId) => !remainingAliases.has(recordId))
  };
}

export function emptyWrongBook(userId: string, clientId = "server"): WrongBookSnapshot {
  return {
    schemaVersion: 2,
    userId,
    clientId,
    updatedAt: new Date().toISOString(),
    records: [],
    deletedRecords: [],
    deletedBatches: []
  };
}

export function normalizeWrongBook(snapshot: Partial<WrongBookSnapshot>, userId: string): WrongBookSnapshot {
  const deletedRecords = normalizeTombstones(snapshot.deletedRecords, (id) => id.toLowerCase());
  const deletedBatches = normalizeTombstones(snapshot.deletedBatches, (id) => id);
  const records = Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord).filter((record) => record.word.length > 0) : [];
  return {
    schemaVersion: 2,
    userId,
    clientId: snapshot.clientId || "unknown",
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
    records: applyTombstones(records, deletedRecords, deletedBatches),
    deletedRecords,
    deletedBatches
  };
}

export function needsWrongBookCanonicalization(snapshot: WrongBookSnapshot) {
  if (snapshot.records.some((record) => record.id !== wrongBookRecordId(record))) return true;

  const aliasTargets = new Map<string, Set<string>>();
  const addAliasTarget = (alias: string, canonicalId: string) => {
    const targets = aliasTargets.get(alias) ?? new Set<string>();
    targets.add(canonicalId);
    aliasTargets.set(alias, targets);
  };
  snapshot.records.forEach((record) => {
    const canonicalId = wrongBookRecordId(record);
    recordIdAliases(record).forEach((alias) => addAliasTarget(alias, canonicalId));
  });
  snapshot.deletedRecords.forEach((tombstone) => {
    const canonicalId = storedCanonicalRecordId(tombstone);
    if (!canonicalId) return;
    tombstoneIdAliases(tombstone).forEach((alias) => addAliasTarget(alias, canonicalId));
  });

  return snapshot.deletedRecords.some((tombstone) => {
    const targets = new Set(tombstoneIdAliases(tombstone).flatMap((alias) => (
      Array.from(aliasTargets.get(alias) ?? [])
    )));
    return targets.size === 1 && !targets.has(tombstone.id);
  });
}

export function mergeWrongBooks(userId: string, ...snapshots: Array<WrongBookSnapshot | null | undefined>): WrongBookSnapshot {
  const presentSnapshots = snapshots.filter((snapshot): snapshot is WrongBookSnapshot => Boolean(snapshot));
  const recordAliases = new Map<string, Set<string>>();
  const canonicalRecordIds = new Map<string, string>();
  presentSnapshots.flatMap((snapshot) => snapshot.records ?? []).forEach((record) => {
    const key = recordKey(record);
    const canonicalId = wrongBookRecordId(record);
    const aliases = recordAliases.get(key) ?? new Set<string>();
    recordIdAliases(record).forEach((alias) => aliases.add(alias));
    recordAliases.set(key, aliases);
    canonicalRecordIds.set(key, canonicalId);
  });

  const normalized = presentSnapshots.map((snapshot) => normalizeWrongBook(snapshot, userId));
  const deletedRecords = mergeWrongBookTombstones(normalized.flatMap((snapshot) => snapshot.deletedRecords));
  const deletedBatches = mergeWrongBookTombstones(normalized.flatMap((snapshot) => snapshot.deletedBatches));
  const records = new Map<string, WrongBookRecord>();

  normalized.flatMap((snapshot) => snapshot.records).forEach((record) => {
    const key = recordKey(record);
    const canonicalId = wrongBookRecordId(record);
    const aliases = recordAliases.get(key) ?? new Set<string>();
    recordIdAliases(record).forEach((alias) => aliases.add(alias));
    recordAliases.set(key, aliases);
    canonicalRecordIds.set(key, canonicalId);
    const existing = records.get(key);
    const historicalAliases = Array.from(aliases).filter((alias) => alias !== canonicalId);
    const canonicalRecord = {
      ...record,
      id: canonicalId,
      aliases: historicalAliases.length > 0 ? historicalAliases : undefined
    };
    records.set(key, existing ? mergeRecords(existing, canonicalRecord) : canonicalRecord);
  });

  const aliasTargets = new Map<string, Set<string>>();
  const addAliasTarget = (alias: string, canonicalId: string) => {
    const targets = aliasTargets.get(alias) ?? new Set<string>();
    targets.add(canonicalId);
    aliasTargets.set(alias, targets);
  };
  recordAliases.forEach((aliases, key) => {
    const canonicalId = canonicalRecordIds.get(key);
    if (!canonicalId) return;
    aliases.forEach((alias) => addAliasTarget(alias, canonicalId));
  });
  deletedRecords.forEach((tombstone) => {
    const canonicalId = storedCanonicalRecordId(tombstone);
    if (!canonicalId) return;
    tombstoneIdAliases(tombstone).forEach((alias) => addAliasTarget(alias, canonicalId));
  });
  const canonicalDeletedRecords = mergeWrongBookTombstones(deletedRecords.map((tombstone) => {
    const targets = new Set(tombstoneIdAliases(tombstone).flatMap((alias) => (
      Array.from(aliasTargets.get(alias) ?? [])
    )));
    if (targets.size !== 1) {
      const canonicalId = storedCanonicalRecordId(tombstone);
      return canonicalId ? { ...tombstone, canonicalRecordId: canonicalId } : tombstone;
    }
    const canonicalId = Array.from(targets)[0];
    if (canonicalId === tombstone.id) return { ...tombstone, canonicalRecordId: canonicalId };
    const aliases = Array.from(new Set([...(tombstone.aliases ?? []), tombstone.id]))
      .filter((alias) => alias !== canonicalId);
    return {
      ...tombstone,
      id: canonicalId,
      canonicalRecordId: canonicalId,
      aliases: aliases.length > 0 ? aliases : undefined
    };
  }));
  const activeRecords = applyTombstones(Array.from(records.values()), canonicalDeletedRecords, deletedBatches);

  return {
    schemaVersion: 2,
    userId,
    clientId: "server-merge",
    updatedAt: new Date().toISOString(),
    records: activeRecords.sort((left, right) => left.word.localeCompare(right.word)),
    deletedRecords: canonicalDeletedRecords,
    deletedBatches
  };
}
