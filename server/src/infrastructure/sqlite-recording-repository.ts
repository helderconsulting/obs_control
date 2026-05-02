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

export const createSqliteRecordingRepository = (
  initialRecording: Recording = createIdleRecording(),
): SqliteRecordingRepository => {
  let database: DatabaseSync | null = null;

  const openDatabase = async (): Promise<DatabaseSync> => {
    if (database !== null) {
      return database;
    }

    await ensureRecordingsDirectory();
    database = createRecordingDatabase();

    if (initialRecording.status !== 'idle') {
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
      return undefined;
    }

    return toRecording(row);
  };

  const saveRecording = async (recording: Recording): Promise<void> => {
    const currentDatabase = await openDatabase();
    const row = toRow(recording);

    const statement = currentDatabase.prepare(`
      INSERT INTO recording_state (id, status, current_filename, message)
      VALUES (1, @status, @current_filename, @message)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        current_filename = excluded.current_filename,
        message = excluded.message
    `);
    statement.run(row);
  };

  return {
    findRecording: async () => hydrate(),
    saveRecording,
  };
};
