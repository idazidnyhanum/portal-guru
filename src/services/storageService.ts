import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { createDefaultRosters, SCHOOL_INFO } from '../constants/school';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ClassRosterMap,
  GameDoc,
  GameScoreRecord,
  SchoolTeacherSettings,
  WorkspaceItemRecord,
} from '../types/portal';

const LS_ROSTERS_KEY = 'sdn_lt_rosters_v1';
const LS_ITEMS_KEY = 'sdn_lt_items_v1';
const LS_SETTINGS_KEY = 'sdn_lt_school_settings_v1';
const LS_GAME_SCORES_KEY = 'sdn_lt_game_scores_v1';

function isOfflineState(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isFirestoreOfflineError(error: unknown): boolean {
  if (isOfflineState()) return true;
  const code = (error as { code?: string } | null)?.code;
  const msg =
    error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('unavailable')
  );
}

/**
 * Strips large base64 image blobs before writing to Firestore (1MB document cap),
 * while keeping full compressed images in localStorage and Express server store.
 */
function sanitizePayloadForFirestore(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadForFirestore(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((k === 'imageDataUrl' || k === 'logoDataUrl') && typeof v === 'string' && v.startsWith('data:image/')) {
        continue;
      }
      if (typeof v === 'string' && v.startsWith('data:image/') && v.length > 512) {
        continue;
      }
      out[k] = sanitizePayloadForFirestore(v);
    }
    return out;
  }
  return value;
}

export function createDefaultSchoolSettings(): SchoolTeacherSettings {
  return {
    pemerintah: SCHOOL_INFO.pemerintah,
    dinas: SCHOOL_INFO.dinas,
    namaSekolah: SCHOOL_INFO.namaSekolah,
    alamat: SCHOOL_INFO.alamat,
    logoDataUrl: '',
    kepalaSekolah: '',
    nipKepalaSekolah: '',
    teacherNips: {},
  };
}

function readLocalSettings(): SchoolTeacherSettings {
  const defaults = createDefaultSchoolSettings();
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SchoolTeacherSettings>;
      return {
        pemerintah: parsed.pemerintah || defaults.pemerintah,
        dinas: parsed.dinas || defaults.dinas,
        namaSekolah: parsed.namaSekolah || defaults.namaSekolah,
        alamat: parsed.alamat !== undefined ? parsed.alamat : defaults.alamat,
        logoDataUrl: parsed.logoDataUrl || '',
        kepalaSekolah: parsed.kepalaSekolah || '',
        nipKepalaSekolah: parsed.nipKepalaSekolah || '',
        teacherNips:
          parsed.teacherNips && typeof parsed.teacherNips === 'object'
            ? parsed.teacherNips
            : {},
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

function writeLocalSettings(settings: SchoolTeacherSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function loadSchoolSettings(): Promise<SchoolTeacherSettings> {
  const local = readLocalSettings();
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = (await res.json()) as { settings?: Partial<SchoolTeacherSettings> };
      if (data.settings) {
        const merged: SchoolTeacherSettings = {
          pemerintah: data.settings.pemerintah || local.pemerintah || SCHOOL_INFO.pemerintah,
          dinas: data.settings.dinas || local.dinas || SCHOOL_INFO.dinas,
          namaSekolah: data.settings.namaSekolah || local.namaSekolah,
          alamat:
            data.settings.alamat !== undefined
              ? data.settings.alamat
              : (local.alamat ?? SCHOOL_INFO.alamat),
          logoDataUrl:
            data.settings.logoDataUrl !== undefined
              ? data.settings.logoDataUrl
              : (local.logoDataUrl ?? ''),
          kepalaSekolah:
            data.settings.kepalaSekolah !== undefined
              ? data.settings.kepalaSekolah
              : local.kepalaSekolah,
          nipKepalaSekolah:
            data.settings.nipKepalaSekolah !== undefined
              ? data.settings.nipKepalaSekolah
              : local.nipKepalaSekolah,
          teacherNips: {
            ...local.teacherNips,
            ...(data.settings.teacherNips || {}),
          },
        };
        writeLocalSettings(merged);
        return merged;
      }
    }
  } catch {
    // fallback to localStorage
  }
  return local;
}

export async function saveSchoolSettings(
  settings: SchoolTeacherSettings
): Promise<SchoolTeacherSettings> {
  const normalized: SchoolTeacherSettings = {
    pemerintah: (settings.pemerintah || '').trim() || SCHOOL_INFO.pemerintah,
    dinas: (settings.dinas || '').trim() || SCHOOL_INFO.dinas,
    namaSekolah: settings.namaSekolah.trim() || SCHOOL_INFO.namaSekolah,
    alamat: (settings.alamat ?? SCHOOL_INFO.alamat).trim(),
    logoDataUrl: settings.logoDataUrl || '',
    kepalaSekolah: settings.kepalaSekolah.trim(),
    nipKepalaSekolah: settings.nipKepalaSekolah.trim(),
    teacherNips: Object.fromEntries(
      Object.entries(settings.teacherNips || {}).map(([k, v]) => [k, String(v || '').trim()])
    ),
  };
  writeLocalSettings(normalized);
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: normalized }),
    });
  } catch {
    // offline fallback already saved
  }
  return normalized;
}

function readLocalRosters(teacherId: string): ClassRosterMap {
  try {
    const raw = localStorage.getItem(LS_ROSTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, ClassRosterMap>;
      if (parsed[teacherId]) {
        return { ...createDefaultRosters(), ...parsed[teacherId] };
      }
    }
  } catch {
    // ignore parse errors
  }
  return createDefaultRosters();
}

function writeLocalRosters(teacherId: string, rosters: ClassRosterMap): void {
  try {
    const raw = localStorage.getItem(LS_ROSTERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ClassRosterMap>) : {};
    parsed[teacherId] = rosters;
    localStorage.setItem(LS_ROSTERS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

function readLocalItems(teacherId: string): WorkspaceItemRecord[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, WorkspaceItemRecord[]>;
      if (Array.isArray(parsed[teacherId])) {
        return parsed[teacherId];
      }
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function writeLocalItems(teacherId: string, items: WorkspaceItemRecord[]): void {
  try {
    const raw = localStorage.getItem(LS_ITEMS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, WorkspaceItemRecord[]>) : {};
    parsed[teacherId] = items;
    localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

function readLocalGameScores(teacherId: string): GameScoreRecord[] {
  try {
    const raw = localStorage.getItem(LS_GAME_SCORES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, GameScoreRecord[]>;
      if (Array.isArray(parsed[teacherId])) {
        return parsed[teacherId];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalGameScores(teacherId: string, scores: GameScoreRecord[]): void {
  try {
    const raw = localStorage.getItem(LS_GAME_SCORES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, GameScoreRecord[]>) : {};
    parsed[teacherId] = scores;
    localStorage.setItem(LS_GAME_SCORES_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

async function ensureCloudUserRoot(uid: string, teacherId: string): Promise<boolean> {
  if (isOfflineState()) return false;
  const userPath = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerUid: uid,
        selectedTeacherId: teacherId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          ownerUid: uid,
          selectedTeacherId: teacherId,
          createdAt: snap.data().createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return true;
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      console.warn('Firestore root sync skipped (offline):', userPath);
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function loadTeacherRosters(teacherId: string): Promise<ClassRosterMap> {
  let result = readLocalRosters(teacherId);

  try {
    const res = await fetch(`/api/rosters/${encodeURIComponent(teacherId)}`);
    if (res.ok) {
      const data = (await res.json()) as { rosters?: ClassRosterMap };
      if (data.rosters && Object.keys(data.rosters).length > 0) {
        result = { ...createDefaultRosters(), ...data.rosters };
        writeLocalRosters(teacherId, result);
      }
    }
  } catch {
    // fallback to localStorage silently
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const rostersPath = `users/${user.uid}/rosters`;
    try {
      const q = query(
        collection(db, 'users', user.uid, 'rosters'),
        where('ownerUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      const cloudMap: ClassRosterMap = { ...result };
      let hasCloud = false;
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.teacherId === teacherId && typeof d.kelas === 'number' && Array.isArray(d.students)) {
          cloudMap[d.kelas] = d.students;
          hasCloud = true;
        }
      });
      if (hasCloud) {
        result = cloudMap;
        writeLocalRosters(teacherId, result);
      }
    } catch (error) {
      if (isFirestoreOfflineError(error)) {
        console.warn('Firestore rosters read skipped (offline):', rostersPath);
      } else {
        handleFirestoreError(error, OperationType.LIST, rostersPath);
      }
    }
  }

  return result;
}

export async function saveClassRoster(
  teacherId: string,
  kelas: number,
  students: string[]
): Promise<ClassRosterMap> {
  const sanitized = students
    .map((s) => s.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 60);

  const current = readLocalRosters(teacherId);
  const updated: ClassRosterMap = { ...current, [kelas]: sanitized };
  writeLocalRosters(teacherId, updated);

  try {
    await fetch(`/api/rosters/${encodeURIComponent(teacherId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelas, students: sanitized }),
    });
  } catch {
    // offline fallback already saved to localStorage
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const ready = await ensureCloudUserRoot(user.uid, teacherId);
    if (ready) {
      const rosterId = `${teacherId}_kelas_${kelas}`;
      const rosterPath = `users/${user.uid}/rosters/${rosterId}`;
      const ref = doc(db, 'users', user.uid, 'rosters', rosterId);
      try {
        const existingSnap = await getDoc(ref);
        if (existingSnap.exists()) {
          await setDoc(
            ref,
            {
              ownerUid: user.uid,
              teacherId,
              kelas,
              students: sanitized,
              createdAt: existingSnap.data().createdAt,
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
        } else {
          await setDoc(ref, {
            ownerUid: user.uid,
            teacherId,
            kelas,
            students: sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        if (isFirestoreOfflineError(error)) {
          console.warn('Firestore roster write skipped (offline):', rosterPath);
        } else {
          handleFirestoreError(error, OperationType.WRITE, rosterPath);
        }
      }
    }
  }

  return updated;
}

export async function loadWorkspaceItems(teacherId: string): Promise<WorkspaceItemRecord[]> {
  const byId = new Map<string, WorkspaceItemRecord>();

  for (const item of readLocalItems(teacherId)) {
    byId.set(item.id, item);
  }

  try {
    const res = await fetch(`/api/workspace/${encodeURIComponent(teacherId)}`);
    if (res.ok) {
      const data = (await res.json()) as { items?: WorkspaceItemRecord[] };
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          const prev = byId.get(item.id);
          if (!prev || item.updatedAt >= prev.updatedAt) {
            byId.set(item.id, item);
          }
        }
      }
    }
  } catch {
    // fallback to localStorage
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const colPath = `users/${user.uid}/workspaceItems`;
    try {
      const q = query(
        collection(db, 'users', user.uid, 'workspaceItems'),
        where('ownerUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.teacherId === teacherId) {
          const createdIso =
            d.createdAt && typeof d.createdAt.toDate === 'function'
              ? d.createdAt.toDate().toISOString()
              : new Date().toISOString();
          const updatedIso =
            d.updatedAt && typeof d.updatedAt.toDate === 'function'
              ? d.updatedAt.toDate().toISOString()
              : new Date().toISOString();
          const prev = byId.get(docSnap.id);
          // Preserve local/server base64 stimulus images if local record is equally recent
          const rec: WorkspaceItemRecord = {
            id: docSnap.id,
            teacherId: d.teacherId,
            itemType: d.itemType,
            title: d.title,
            mapel: d.mapel,
            kelas: d.kelas,
            createdAt: createdIso,
            updatedAt: updatedIso,
            payload: prev && prev.updatedAt >= updatedIso ? prev.payload : d.payload,
          };
          byId.set(rec.id, rec);
        }
      });
    } catch (error) {
      if (isFirestoreOfflineError(error)) {
        console.warn('Firestore workspace read skipped (offline):', colPath);
      } else {
        handleFirestoreError(error, OperationType.LIST, colPath);
      }
    }
  }

  const merged = Array.from(byId.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  writeLocalItems(teacherId, merged);

  for (const item of merged) {
    if (item.itemType === 'game' && item.payload) {
      void publishPublicGame(item.payload as GameDoc);
    }
  }
  return merged;
}

export async function saveWorkspaceItem(record: WorkspaceItemRecord): Promise<WorkspaceItemRecord[]> {
  const safeId =
    record.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || `item_${Date.now()}`;
  const safeTitle = record.title.trim().slice(0, 200) || 'Dokumen Pembelajaran';
  const safeMapel = (String(record.mapel || 'PAI BP').trim().slice(0, 80) || 'PAI BP') as WorkspaceItemRecord['mapel'];
  const safeKelas = Math.min(6, Math.max(1, Math.round(Number(record.kelas) || 1)));
  const normalized: WorkspaceItemRecord = {
    ...record,
    id: safeId,
    title: safeTitle,
    mapel: safeMapel,
    kelas: safeKelas,
    updatedAt: new Date().toISOString(),
  };

  const current = readLocalItems(normalized.teacherId);
  const nextLocal = [normalized, ...current.filter((i) => i.id !== normalized.id)];
  writeLocalItems(normalized.teacherId, nextLocal);

  try {
    await fetch(`/api/workspace/${encodeURIComponent(normalized.teacherId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
  } catch {
    // localStorage fallback active
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const ready = await ensureCloudUserRoot(user.uid, normalized.teacherId);
    if (ready) {
      const itemPath = `users/${user.uid}/workspaceItems/${normalized.id}`;
      const ref = doc(db, 'users', user.uid, 'workspaceItems', normalized.id);
      try {
        const existingSnap = await getDoc(ref);
        const plainPayload = sanitizePayloadForFirestore(JSON.parse(JSON.stringify(normalized.payload)));
        if (existingSnap.exists()) {
          await setDoc(
            ref,
            {
              ownerUid: user.uid,
              teacherId: normalized.teacherId,
              itemType: normalized.itemType,
              title: normalized.title,
              mapel: normalized.mapel,
              kelas: normalized.kelas,
              payload: plainPayload,
              createdAt: existingSnap.data().createdAt,
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
        } else {
          await setDoc(ref, {
            ownerUid: user.uid,
            teacherId: normalized.teacherId,
            itemType: normalized.itemType,
            title: normalized.title,
            mapel: normalized.mapel,
            kelas: normalized.kelas,
            payload: plainPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        if (isFirestoreOfflineError(error)) {
          console.warn('Firestore workspace write skipped (offline):', itemPath);
        } else {
          handleFirestoreError(error, OperationType.WRITE, itemPath);
        }
      }
    }
  }

  return nextLocal;
}

export async function deleteWorkspaceItem(
  teacherId: string,
  itemId: string
): Promise<WorkspaceItemRecord[]> {
  const current = readLocalItems(teacherId);
  const nextLocal = current.filter((i) => i.id !== itemId);
  writeLocalItems(teacherId, nextLocal);

  try {
    await fetch(
      `/api/workspace/${encodeURIComponent(teacherId)}/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' }
    );
  } catch {
    // ignore network failure
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const itemPath = `users/${user.uid}/workspaceItems/${itemId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workspaceItems', itemId));
    } catch (error) {
      if (isFirestoreOfflineError(error)) {
        console.warn('Firestore workspace delete skipped (offline):', itemPath);
      } else {
        handleFirestoreError(error, OperationType.DELETE, itemPath);
      }
    }
  }

  return nextLocal;
}

export async function publishPublicGame(game: GameDoc): Promise<void> {
  if (!game || !game.id) return;
  try {
    await fetch('/api/public-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
  } catch {
    // ignore network failure
  }

  const user = auth.currentUser;
  if (user && user.emailVerified) {
    const safeId = game.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    if (!safeId) return;
    const publicPath = `publicGames/${safeId}`;
    const ref = doc(db, 'publicGames', safeId);
    try {
      const existingSnap = await getDoc(ref);
      const compactItems = (game.items || []).slice(0, 30).map((item) => ({
        id: String(item.id || ''),
        prompt: String(item.prompt || '').slice(0, 500),
        answer: String(item.answer || '').slice(0, 200),
        options: Array.isArray(item.options) ? item.options.slice(0, 4).map((o) => String(o || '').slice(0, 200)) : [],
        clue: item.clue ? String(item.clue).slice(0, 250) : '',
      }));
      const baseData = {
        ownerUid: user.uid,
        id: safeId,
        title: String(game.title || 'Game Edukasi').slice(0, 200),
        topic: String(game.topic || '').slice(0, 300),
        teacherId: String(game.teacherId || 'guru').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
        teacherName: String(game.teacherName || 'Guru').slice(0, 120),
        mapel: String(game.mapel || 'PAI BP').slice(0, 80),
        kelas: Math.min(6, Math.max(1, Math.round(Number(game.kelas) || 1))),
        template: game.template,
        items: compactItems,
        players: (game.players || []).slice(0, 60).map((p) => String(p || '').slice(0, 100)),
      };
      if (existingSnap.exists()) {
        await setDoc(
          ref,
          {
            ...baseData,
            createdAt: existingSnap.data().createdAt,
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        );
      } else {
        await setDoc(ref, {
          ...baseData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.warn('Firestore publicGames sync skipped:', publicPath, error);
    }
  }
}

export async function fetchPublicGameById(gameId: string): Promise<GameDoc | null> {
  try {
    const res = await fetch(`/api/public-games/${encodeURIComponent(gameId)}`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = (await res.json()) as { game?: GameDoc };
      if (data.game) return data.game;
    }
  } catch {
    // fallback check Firestore and localStorage
  }

  try {
    const safeId = gameId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    if (safeId) {
      const snap = await getDoc(doc(db, 'publicGames', safeId));
      if (snap.exists()) {
        const d = snap.data();
        return {
          id: String(d.id || safeId),
          title: String(d.title || 'Game Edukasi'),
          topic: String(d.topic || ''),
          teacherId: String(d.teacherId || ''),
          teacherName: String(d.teacherName || 'Guru'),
          mapel: d.mapel as GameDoc['mapel'],
          kelas: Number(d.kelas || 1),
          template: d.template as GameDoc['template'],
          playMode: 'live-mobile',
          items: Array.isArray(d.items) ? d.items : [],
          players: Array.isArray(d.players) ? d.players : [],
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // ignore Firestore public read miss
  }

  try {
    const raw = localStorage.getItem(LS_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, WorkspaceItemRecord[]>;
      for (const list of Object.values(parsed)) {
        const found = list.find((item) => item.id === gameId && item.itemType === 'game');
        if (found) return found.payload as GameDoc;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function loadGameScores(teacherId: string): Promise<GameScoreRecord[]> {
  const byId = new Map<string, GameScoreRecord>();
  for (const rec of readLocalGameScores(teacherId)) {
    byId.set(rec.id, rec);
  }

  try {
    const res = await fetch(`/api/game-scores/${encodeURIComponent(teacherId)}`);
    if (res.ok) {
      const data = (await res.json()) as { scores?: GameScoreRecord[] };
      if (Array.isArray(data.scores)) {
        for (const rec of data.scores) {
          const prev = byId.get(rec.id);
          if (!prev || rec.savedAt >= prev.savedAt) {
            byId.set(rec.id, rec);
          }
        }
      }
    }
  } catch {
    // fallback localStorage
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const colPath = `users/${user.uid}/gameScores`;
    try {
      const q = query(
        collection(db, 'users', user.uid, 'gameScores'),
        where('ownerUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.teacherId === teacherId) {
          byId.set(docSnap.id, {
            id: docSnap.id,
            teacherId: d.teacherId,
            gameId: d.gameId,
            gameTitle: d.gameTitle,
            mapel: d.mapel,
            kelas: d.kelas,
            roomCode: d.roomCode,
            savedAt: d.savedAt,
            entries: Array.isArray(d.entries) ? d.entries : [],
          });
        }
      });
    } catch (error) {
      if (isFirestoreOfflineError(error)) {
        console.warn('Firestore gameScores read skipped (offline):', colPath);
      } else {
        handleFirestoreError(error, OperationType.LIST, colPath);
      }
    }
  }

  const sorted = Array.from(byId.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  writeLocalGameScores(teacherId, sorted);
  return sorted;
}

export async function saveGameScoreRecord(record: GameScoreRecord): Promise<GameScoreRecord[]> {
  const safeId = record.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || `score_${Date.now()}`;
  const normalized: GameScoreRecord = {
    ...record,
    id: safeId,
    gameId: record.gameId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'game',
    gameTitle: record.gameTitle.trim().slice(0, 200) || 'Game Edukasi',
    kelas: Math.min(6, Math.max(1, Math.round(Number(record.kelas) || 1))),
    roomCode: record.roomCode.slice(0, 32),
    entries: record.entries.slice(0, 60),
  };

  const current = readLocalGameScores(normalized.teacherId);
  const next = [normalized, ...current.filter((s) => s.id !== normalized.id)];
  writeLocalGameScores(normalized.teacherId, next);

  try {
    await fetch(`/api/game-scores/${encodeURIComponent(normalized.teacherId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
  } catch {
    // offline fallback active
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const ready = await ensureCloudUserRoot(user.uid, normalized.teacherId);
    if (ready) {
      const scorePath = `users/${user.uid}/gameScores/${normalized.id}`;
      const ref = doc(db, 'users', user.uid, 'gameScores', normalized.id);
      try {
        const existingSnap = await getDoc(ref);
        const baseData = {
          ownerUid: user.uid,
          teacherId: normalized.teacherId,
          gameId: normalized.gameId,
          gameTitle: normalized.gameTitle,
          mapel: normalized.mapel,
          kelas: normalized.kelas,
          roomCode: normalized.roomCode,
          savedAt: normalized.savedAt,
          entries: normalized.entries,
        };
        if (existingSnap.exists()) {
          await setDoc(
            ref,
            { ...baseData, createdAt: existingSnap.data().createdAt, updatedAt: serverTimestamp() },
            { merge: false }
          );
        } else {
          await setDoc(ref, {
            ...baseData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        if (isFirestoreOfflineError(error)) {
          console.warn('Firestore gameScores write skipped (offline):', scorePath);
        } else {
          handleFirestoreError(error, OperationType.WRITE, scorePath);
        }
      }
    }
  }

  return next;
}

export async function deleteGameScoreRecord(
  teacherId: string,
  scoreId: string
): Promise<GameScoreRecord[]> {
  const current = readLocalGameScores(teacherId);
  const next = current.filter((s) => s.id !== scoreId);
  writeLocalGameScores(teacherId, next);

  try {
    await fetch(
      `/api/game-scores/${encodeURIComponent(teacherId)}/${encodeURIComponent(scoreId)}`,
      { method: 'DELETE' }
    );
  } catch {
    // ignore
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && !isOfflineState()) {
    const scorePath = `users/${user.uid}/gameScores/${scoreId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'gameScores', scoreId));
    } catch (error) {
      if (isFirestoreOfflineError(error)) {
        console.warn('Firestore gameScores delete skipped (offline):', scorePath);
      } else {
        handleFirestoreError(error, OperationType.DELETE, scorePath);
      }
    }
  }

  return next;
}
