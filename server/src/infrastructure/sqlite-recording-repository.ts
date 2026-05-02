import { mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type { Recording } from '../../../shared/recording.js';
import {
  createIdleRecording,
  createIdleRecordingWithFilename,
  createRecording,
  createRecordingError,
  createStartingRecording,
  createStoppingRecording,
} from '../domain/recording.js';
import type { RecordingRepository } from '../application/recording-control.js';
import type { AppLogger } from './recording-logger.js';

const recordingsDirectory = join(process.cwd(), '.recordings');
const databasePath = join(recordingsDirectory, 'recordings.db');

type RecordingRow = {
  status: Recording['status'];
  scene_name: string;
  last_recording_filename: string | null;
  message: string | null;
};

const ensureRecordingsDirectory = async (): Promise<void> => {
  await mkdir(recordingsDirectory, { recursive: true });
};

const createRecordingDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS recording_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL,
      scene_name TEXT,
      last_recording_filename TEXT,
      message TEXT
    ) STRICT;
  `);

  return database;
};

const upsertRecordingRow = (database: DatabaseSync, recording: Recording): void => {
  const row = toRow(recording);
  const statement = database.prepare(`
    INSERT INTO recording_state (id, status, scene_name, last_recording_filename, message)
    VALUES (1, @status, @scene_name, @last_recording_filename, @message)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      scene_name = excluded.scene_name,
      last_recording_filename = excluded.last_recording_filename,
      message = excluded.message
  `);

  statement.run(row);
};

const toRecording = (row: RecordingRow): Recording => {
  switch (row.status) {
    case 'recording':
      return createRecording(row.scene_name, row.last_recording_filename);
    case 'starting':
      return createStartingRecording(row.scene_name, row.last_recording_filename);
    case 'stopping':
      return createStoppingRecording(row.scene_name, row.last_recording_filename);
    case 'error':
      return createRecordingError(
        row.message ?? 'Recording failed.',
        row.scene_name,
        row.last_recording_filename,
      );
    case 'idle':
    default:
      return createIdleRecordingWithFilename(row.scene_name, row.last_recording_filename);
  }
};

const toRow = (recording: Recording): RecordingRow => {
  if (recording.status === 'error') {
    return {
      status: recording.status,
      scene_name: '',
      last_recording_filename: recording.lastRecordingFilename,
      message: recording.message,
    };
  }

  return {
    status: recording.status,
    scene_name: recording.sceneName,
    last_recording_filename: recording.lastRecordingFilename,
    message: null,
  };
};

export type SqliteRecordingRepository = RecordingRepository;
export type SqliteRecordingRepositoryDeps = {
  initialRecording?: Recording;
  logger: AppLogger;
};

export const createSqliteRecordingRepository = (
  deps: SqliteRecordingRepositoryDeps,
): SqliteRecordingRepository => {
  const initialRecording = deps.initialRecording ?? createIdleRecording('');
  let database: DatabaseSync | null = null;

  const openDatabase = async (): Promise<DatabaseSync> => {
    if (database !== null) {
      return database;
    }

    deps.logger.debug({ databasePath }, 'Opening recording SQLite database.');
    await ensureRecordingsDirectory();
    database = createRecordingDatabase();

    const persistedRow = database
      .prepare(
        'SELECT status, scene_name, last_recording_filename, message FROM recording_state WHERE id = 1',
      )
      .get() as RecordingRow | undefined;

    if (persistedRow === undefined) {
      deps.logger.debug(
        { status: initialRecording.status },
        'Seeding recording SQLite database with initial state.',
      );
      upsertRecordingRow(database, initialRecording);
    }

    return database;
  };

  const hydrate = async (): Promise<Recording | undefined> => {
    const currentDatabase = await openDatabase();
    const row = currentDatabase
      .prepare(
        'SELECT status, scene_name, last_recording_filename, message FROM recording_state WHERE id = 1',
      )
      .get() as RecordingRow | undefined;

    if (row === undefined) {
      deps.logger.warn('Recording SQLite repository returned no persisted state.');
      return undefined;
    }

    const recording = toRecording(row);
    deps.logger.debug({ status: recording.status }, 'Loaded recording state from SQLite.');

    return recording;
  };

  const saveRecording = async (recording: Recording): Promise<void> => {
    const currentDatabase = await openDatabase();
    deps.logger.debug({ status: recording.status }, 'Persisting recording state to SQLite.');

    upsertRecordingRow(currentDatabase, recording);
    deps.logger.info({ status: recording.status }, 'Persisted recording state to SQLite.');
  };

  return {
    findRecording: async () => hydrate(),
    saveRecording,
  };
};
