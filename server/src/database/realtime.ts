import { randomUUID } from "crypto";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  runTransaction,
  goOffline,
  type Database,
  type DatabaseReference,
} from "firebase/database";
import { config } from "../config";
import { AppError } from "../utils/AppError";

/**
 * Single point of contact with the Firebase Realtime Database. Nothing else in
 * the codebase imports `firebase/database` directly, so swapping this file for
 * the Admin SDK (service account) later is a contained change.
 */

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(config.firebase);

export const rtdb: Database = getDatabase(app);

if (config.databaseEmulatorHost) {
  const [host, port] = config.databaseEmulatorHost.split(":");
  connectDatabaseEmulator(rtdb, host, Number(port));
}

/**
 * Tree layout:
 *
 *   /users/{userId}                 account + wallet
 *   /usernames/{usernameLower}      -> userId   (uniqueness)
 *   /emails/{emailLower}            -> userId   (uniqueness)
 *   /tableCodes/{CODE}              -> tableId  (uniqueness)
 *   /tables/{tableId}               meta + players + current round
 *   /tableHistory/{tableId}/{id}    append-only action log
 *   /userLedger/{userId}/{id}       append-only chip ledger
 *
 * Everything a chip operation must change atomically (a player's balance, their
 * round contribution, the pot, whose turn it is) lives under a single
 * /tables/{tableId} node, because a Realtime Database transaction covers one
 * subtree. The history and ledger are append-only and deliberately kept outside
 * that node so transactions stay small.
 */
/**
 * Realtime Database keys cannot contain ".", "#", "$", "[", "]" or "/", which
 * rules out using an email address as a key verbatim. These keys are only ever
 * looked up, never decoded, so a one-way escape is enough.
 */
export const encodeKey = (value: string): string =>
  value
    .replace(/%/g, "%25")
    .replace(/\./g, "%2E")
    .replace(/#/g, "%23")
    .replace(/\$/g, "%24")
    .replace(/\[/g, "%5B")
    .replace(/\]/g, "%5D")
    .replace(/\//g, "%2F");

export const paths = {
  user: (userId: string) => `users/${userId}`,
  users: () => "users",
  username: (usernameLower: string) => `usernames/${encodeKey(usernameLower)}`,
  email: (emailLower: string) => `emails/${encodeKey(emailLower)}`,
  tableCode: (code: string) => `tableCodes/${encodeKey(code)}`,
  table: (tableId: string) => `tables/${tableId}`,
  tables: () => "tables",
  tableHistory: (tableId: string) => `tableHistory/${tableId}`,
  userLedger: (userId: string) => `userLedger/${userId}`,
};

export const newId = () => randomUUID();

/** Timestamps are ISO strings: JSON-friendly and lexicographically sortable. */
export const nowIso = () => new Date().toISOString();

export const readPath = async <T>(path: string): Promise<T | null> => {
  const snap = await get(ref(rtdb, path));
  return snap.exists() ? (snap.val() as T) : null;
};

/** Reads a keyed node as an array, dropping the keys. */
export const readCollection = async <T>(path: string): Promise<T[]> => {
  const value = await readPath<Record<string, T>>(path);
  return value ? Object.values(value) : [];
};

/** Reads a keyed node as an array, keeping each child's key as `id`. */
export const readKeyed = async <T>(path: string): Promise<(T & { id: string })[]> => {
  const value = await readPath<Record<string, T>>(path);
  return value ? Object.entries(value).map(([id, item]) => ({ id, ...item })) : [];
};

export const writePath = async <T>(path: string, value: T): Promise<void> => {
  await set(ref(rtdb, path), value);
};

export const removePath = async (path: string): Promise<void> => {
  await remove(ref(rtdb, path));
};

/** Closes the realtime connection so a process (e.g. the test runner) can exit. */
export const disconnect = () => goOffline(rtdb);

/** Multi-path fan-out write. Atomic across all the paths in the map. */
export const updatePaths = async (updates: Record<string, unknown>): Promise<void> => {
  await update(ref(rtdb), updates);
};

/** Appends a value under `path` using a generated push key. */
export const appendTo = async <T>(path: string, value: T): Promise<string> => {
  const created = push(ref(rtdb, path));
  await set(created, value);
  return created.key as string;
};

/**
 * Generates a push key without writing anything, so several appends can be
 * bundled into a single atomic `updatePaths` call.
 */
export const pushKey = (path: string): string => push(ref(rtdb, path)).key as string;

/**
 * Read-modify-write against a single subtree with optimistic concurrency.
 *
 * `mutate` may run several times (and must therefore stay a pure function of
 * `current`), so validation failures are reported by returning `{ error }`
 * instead of throwing — the error from the final attempt is thrown afterwards.
 * The node is fetched first so the SDK has server state cached and `current` is
 * never a spurious null on the first invocation.
 */
export const transact = async <T>(
  path: string,
  mutate: (current: T | null) => { next: T } | { error: AppError },
): Promise<T> => {
  const node = ref(rtdb, path);
  const detach = await syncNode(node);

  let failure: AppError | null = null;

  try {
    const result = await runTransaction(node, (current: T | null) => {
      failure = null;
      const outcome = mutate(current);
      if ("error" in outcome) {
        failure = outcome.error;
        return; // abort
      }
      return outcome.next;
    });

    if (failure) throw failure;
    if (!result.committed) {
      throw new AppError("Não foi possível concluir a ação. Tente novamente.", 409, "TRANSACTION_ABORTED");
    }

    return result.snapshot.val() as T;
  } finally {
    detach();
  }
};

/**
 * Keeps a node in the client's sync tree until the returned function is called,
 * and resolves once its server value has arrived.
 *
 * Without this the first call to a transaction handler can receive `null` for a
 * node that does exist — the handler runs against the local cache, and a plain
 * `get()` does not populate it. A rule like "this table must exist" would then
 * reject a perfectly valid action.
 */
const syncNode = (node: DatabaseReference): Promise<() => void> =>
  new Promise((resolve, reject) => {
    let detach: () => void = () => {};
    detach = onValue(
      node,
      () => resolve(() => detach()),
      (err) => reject(err),
    );
  });
