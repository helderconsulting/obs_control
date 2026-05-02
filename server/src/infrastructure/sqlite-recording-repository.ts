import { mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type { Recording } from '../../../shared/recording.js';
import {
  createIdleRecording,
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
  current_filename: string | null;
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
      current_filename TEXT,
      message TEXT
    ) STRICT;
  `);

  return database;
};

const toRecording = (row: RecordingRow): Recording => {
  switch (row.status) {
    case 'recording':
      return createRecording(row.current_filename);
    case 'starting':
      return createStartingRecording();
    case 'stopping':
      return createStoppingRecording();
    case 'error':
      return createRecordingError(row.message ?? 'Recording failed.');
    case 'idle':
    default:
      return createIdleRecording();
  }
};

const toRow = (recording: Recording): RecordingRow => {
  if (recording.status === 'recording') {
    return {
      status: recording.status,
      current_filename: recording.currentFilename,
      message: null,
    };
  }

  if (recording.status === 'error') {
    return {
      status: recording.status,
      current_filename: null,
      message: recording.message,
    };
  }

  return {
    status: recording.status,
    current_filename: null,
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
  const initialRecording = deps.initialRecording ?? createIdleRecording();
  let database: DatabaseSync | null = null;

  const openDatabase = async (): Promise<DatabaseSync> => {
    if (database !== null) {
      return database;
    }

    deps.logger.debug({ databasePath }, 'Opening recording SQLite database.');
    await ensureRecordingsDirectory();
    database = createRecordingDatabase();

    if (initialRecording.status !== 'idle') {
      deps.logger.debug(
        { status: initialRecording.status },
        'Seeding recording SQLite database with initial state.',
      );
      const statement = database.prepare(`
        INSERT INTO recording_state (id, status, current_filename, message)
        VALUES (1, @status, @current_filename, @message)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          current_filename = excluded.current_filename,
          message = excluded.message
      `);
      statement.run(toRow(initialRecording));
    }

    return database;
  };

  const hydrate = async (): Promise<Recording | undefined> => {
    const currentDatabase = await openDatabase();
    const row = currentDatabase
      .prepare('SELECT status, current_filename, message FROM recording_state WHERE id = 1')
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
    const row = toRow(recording);
    deps.logger.debug({ status: recording.status }, 'Persisting recording state to SQLite.');

    const statement = currentDatabase.prepare(`
      INSERT INTO recording_state (id, status, current_filename, message)
      VALUES (1, @status, @current_filename, @message)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        current_filename = excluded.current_filename,
        message = excluded.message
    `);
    statement.run(row);
    deps.logger.info({ status: recording.status }, 'Persisted recording state to SQLite.');
  };

  return {
    findRecording: async () => hydrate(),
    saveRecording,
  };
};
