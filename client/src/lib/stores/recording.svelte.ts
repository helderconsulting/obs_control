import { fetchObsConnectionStatus, fetchRecording, fetchObsScenes } from '$lib/api/recording.js';
import { connectRecordingWebSocket } from '$lib/api/recording-websocket.js';
import type {
  Recording,
  RecordingCommand,
  RecordingEvent,
} from '../../../../shared/recording.js';
import type { ObsConnectionStatus } from '$lib/api/recording.js';
import type { RecordingGatewayError } from '$lib/api/recording-websocket.js';

export class RecordingState {
  recording = $state<Recording>({
    status: 'idle',
    sceneName: '',
    lastRecordingFilename: null,
  });
  isLoading = $state(true);
  isSocketConnected = $state(false);
  connectionError = $state('');
  obsScenes = $state<string[]>([]);
  obsConnectionStatus = $state<ObsConnectionStatus>({
    status: 'disconnected',
    url: 'Unavailable',
    checkedAt: null,
    message: 'OBS connection has not been checked yet.',
  });

  private sendCommandFn: ((command: RecordingCommand) => void) | null = null;
  private disconnectFn: (() => void) | null = null;

  constructor() {}

  async loadRecording(clearConnectionError = true) {
    this.isLoading = true;
    if (clearConnectionError) {
      this.connectionError = '';
    }

    try {
      const result = await fetchRecording();
      if (result.ok) {
        this.recording = result.recording;
        return;
      }
      this.recording = {
        status: 'error',
        message: result.error.message,
        sceneName: this.recording.sceneName,
        lastRecordingFilename: this.recording.lastRecordingFilename,
      };
    } catch {
      this.recording = {
        status: 'error',
        message: 'Failed to load recording state.',
        sceneName: this.recording.sceneName,
        lastRecordingFilename: this.recording.lastRecordingFilename,
      };
    } finally {
      this.isLoading = false;
    }
  }

  async loadObsConnectionStatus() {
    try {
      this.obsConnectionStatus = await fetchObsConnectionStatus();
    } catch {
      this.obsConnectionStatus = {
        status: 'disconnected',
        url: this.obsConnectionStatus.url,
        checkedAt: this.obsConnectionStatus.checkedAt,
        message: 'Failed to fetch OBS connection status.',
      };
    }
  }

  async loadObsScenes() {
    try {
      this.obsScenes = await fetchObsScenes();
    } catch {
      this.obsScenes = [];
    }
  }

  applyRecordingEvent(event: RecordingEvent) {
    if (event.type === 'recording.started') {
      this.recording = {
        status: 'recording',
        sceneName: event.delta.sceneName,
        lastRecordingFilename: event.delta.lastRecordingFilename,
      };
      this.connectionError = '';
      return;
    }

    if (event.type === 'recording.failed') {
      this.recording = {
        status: 'error',
        message: event.delta.message,
        sceneName: event.delta.sceneName,
        lastRecordingFilename: event.delta.lastRecordingFilename,
      };
      this.connectionError = '';
      return;
    }

    if (event.type === 'recording.scene-switched') {
      this.recording = {
        status: 'switching-scene',
        sceneName: event.delta.sceneName,
        lastRecordingFilename: this.recording.lastRecordingFilename,
      };
      this.connectionError = '';
      return;
    }

    this.recording = {
      status: 'idle',
      sceneName: event.delta.sceneName,
      lastRecordingFilename: event.delta.lastRecordingFilename,
    };
    this.connectionError = '';
  }

  switchScene(sceneName: string) {
    if (!this.sendCommandFn) {
      this.connectionError = 'WebSocket connection is not available.';
      return;
    }
    this.sendCommandFn({
      type: 'recording.switch-scene',
      sceneName,
    });
  }

  startRecording() {
    if (!this.sendCommandFn) {
      this.connectionError = 'WebSocket connection is not available.';
      return;
    }

    this.connectionError = '';
    this.recording = {
      status: 'starting',
      sceneName: this.recording.sceneName,
      lastRecordingFilename: this.recording.lastRecordingFilename,
    };
    this.sendCommandFn({
      type: 'recording.start',
    });
  }

  stopRecording() {
    if (!this.sendCommandFn) {
      this.connectionError = 'WebSocket connection is not available.';
      return;
    }

    this.connectionError = '';
    this.recording = {
      status: 'stopping',
      sceneName: this.recording.sceneName,
      lastRecordingFilename: this.recording.lastRecordingFilename,
    };
    this.sendCommandFn({
      type: 'recording.stop',
    });
  }

  init() {
    const connection = connectRecordingWebSocket({
      onEvent: (event) => this.applyRecordingEvent(event),
      onError: (error: RecordingGatewayError) => {
        this.connectionError = error.message;
        void this.loadRecording(false);
        void this.loadObsConnectionStatus();
      },
      onOpen: () => {
        this.isSocketConnected = true;
        this.connectionError = '';
      },
      onClose: () => {
        this.isSocketConnected = false;
      },
    });

    this.sendCommandFn = connection.sendCommand;
    this.disconnectFn = connection.disconnect;

    void this.loadRecording();
    void this.loadObsConnectionStatus();
    void this.loadObsScenes();
  }

  destroy() {
    this.sendCommandFn = null;
    if (this.disconnectFn) {
      this.disconnectFn();
      this.disconnectFn = null;
    }
  }
}
