<svelte:head>
  <title>Recording Control</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { Recording, RecordingCommand } from '../../../../shared/recording.js';
  import type { RecordingEvent } from '../../../../shared/recording.js';
  import { fetchObsConnectionStatus, fetchRecording, fetchObsScenes } from '$lib/api/recording.js';
  import type { ObsConnectionStatus } from '$lib/api/recording.js';
  import { connectRecordingWebSocket } from '$lib/api/recording-websocket.js';

  let recording: Recording = {
    status: 'idle',
    lastRecordingFilename: null,
  };
  let isLoading = true;
  let isSocketConnected = false;
  let connectionError = '';
  let obsScenes = [];
  let obsConnectionStatus: ObsConnectionStatus = {
    status: 'disconnected',
    url: 'Unavailable',
    checkedAt: null,
    message: 'OBS connection has not been checked yet.',
  };
  let sendCommand: ((command: RecordingCommand) => void) | null = null;

  const statusLabelByStatus: Record<Recording['status'], string> = {
    idle: 'Idle',
    starting: 'Starting',
    recording: 'Recording',
    stopping: 'Stopping',
    error: 'Error',
  };

  const loadRecording = async (clearConnectionError = true): Promise<void> => {
    isLoading = true;

    if (clearConnectionError) {
      connectionError = '';
    }

    try {
      const result = await fetchRecording();

      if (result.ok) {
        recording = result.recording;
        return;
      }

      recording = {
        status: 'error',
        message: result.error.message,
        lastRecordingFilename: recording.lastRecordingFilename,
      };
    } catch {
      recording = {
        status: 'error',
        message: 'Failed to load recording state.',
        lastRecordingFilename: recording.lastRecordingFilename,
      };
    } finally {
      isLoading = false;
    }
  };

  const loadObsConnectionStatus = async (): Promise<void> => {
    try {
      obsConnectionStatus = await fetchObsConnectionStatus();
    } catch {
      obsConnectionStatus = {
        status: 'disconnected',
        url: obsConnectionStatus.url,
        checkedAt: obsConnectionStatus.checkedAt,
        message: 'Failed to fetch OBS connection status.',
      };
    }
  };

  const loadObsScenes = async (): Promise<void> => {
    try {
      obsScenes = await fetchObsScenes();
    } catch {
      obsScenes = [];
    }
  };

  const applyRecordingEvent = (event: RecordingEvent): void => {
    if (event.type === 'recording.started') {
      recording = {
        status: 'recording',
        lastRecordingFilename: event.delta.lastRecordingFilename,
      };
      connectionError = '';
      return;
    }

    if (event.type === 'recording.failed') {
      recording = {
        status: 'error',
        message: event.delta.message,
        lastRecordingFilename: event.delta.lastRecordingFilename,
      };
      connectionError = '';
      return;
    }

    recording = {
      status: 'idle',
      lastRecordingFilename: event.delta.lastRecordingFilename,
    };
    connectionError = '';
  };

  const handleSwitchScene = (sceneName: string): void => {
    if (sendCommand === null) {
      connectionError = 'WebSocket connection is not available.';
      return;
    }
    sendCommand({
      type: 'recording.switch-scene',
      sceneName,
    });
  };

  const handleStartRecording = (): void => {
    if (sendCommand === null) {
      connectionError = 'WebSocket connection is not available.';
      return;
    }

    connectionError = '';
    recording = {
      status: 'starting',
      lastRecordingFilename: recording.lastRecordingFilename,
    };
    sendCommand({
      type: 'recording.start',
    });
  };

  const handleStopRecording = (): void => {
    if (sendCommand === null) {
      connectionError = 'WebSocket connection is not available.';
      return;
    }

    connectionError = '';
    recording = {
      status: 'stopping',
      lastRecordingFilename: recording.lastRecordingFilename,
    };
    sendCommand({
      type: 'recording.stop',
    });
  };

  onMount(() => {
    const connection = connectRecordingWebSocket({
      onEvent: (event) => {
        applyRecordingEvent(event);
      },
      onError: (error) => {
        connectionError = error.message;
        void loadRecording(false);
        void loadObsConnectionStatus();
      },
      onOpen: () => {
        isSocketConnected = true;
        connectionError = '';
      },
      onClose: () => {
        isSocketConnected = false;
      },
    });
    sendCommand = connection.sendCommand;

    void loadRecording();
    void loadObsConnectionStatus();
    void loadObsScenes();

    return () => {
      sendCommand = null;
      connection.disconnect();
    };
  });

  let recordingFilename = 'No saved recording yet';
  let statusLabel = statusLabelByStatus.idle;
  let obsStatusLabel = 'Disconnected';
  let isInteractive = false;
  let canStart = false;
  let canStop = false;
  let showAlert = false;
  let alertMessage = '';
  let statusDotClass = 'bg-slate-400 shadow-[0_0_0_6px_rgba(148,163,184,0.12)]';
  let obsStatusDotClass = 'bg-rose-400 shadow-[0_0_0_6px_rgba(251,113,133,0.16)]';

  $: recordingFilename =
    recording.lastRecordingFilename !== null
      ? recording.lastRecordingFilename
      : recording.status === 'recording' ||
          recording.status === 'starting' ||
          recording.status === 'stopping'
        ? 'OBS reports the recording file after the recording stops.'
        : 'No saved recording yet';
  $: statusLabel = statusLabelByStatus[recording.status];
  $: obsStatusLabel = obsConnectionStatus.status === 'connected' ? 'Connected to OBS' : 'OBS disconnected';
  $: isInteractive = !isLoading;
  $: canStart = isInteractive && (recording.status === 'idle' || recording.status === 'error');
  $: canStop = isInteractive && recording.status === 'recording';
  $: showAlert = recording.status === 'error';
  $: alertMessage = recording.status === 'error' ? recording.message : '';
  $: statusDotClass =
    recording.status === 'recording'
      ? 'bg-orange-500 shadow-[0_0_0_6px_rgba(249,115,22,0.18)]'
      : recording.status === 'starting' || recording.status === 'stopping'
        ? 'bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,0.16)]'
        : 'bg-slate-400 shadow-[0_0_0_6px_rgba(148,163,184,0.12)]';
  $: obsStatusDotClass =
    obsConnectionStatus.status === 'connected'
      ? 'bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.16)]'
      : 'bg-rose-400 shadow-[0_0_0_6px_rgba(251,113,133,0.16)]';
</script>

<main class="mx-auto grid min-h-screen max-w-6xl gap-6 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.18),transparent_30%),linear-gradient(160deg,#0d1528_0%,#101a30_55%,#152441_100%)] px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
  <section class="grid gap-6 rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:grid-cols-[1.6fr_0.9fr] lg:p-7">
    <div class="grid content-start gap-4">
      <p class="m-0 text-[0.74rem] uppercase tracking-[0.18em] text-amber-300">OBS Studio</p>
      <h1 class="m-0 text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[0.94] tracking-[-0.04em]">
        Recording Control
      </h1>
      <p class="m-0 max-w-[46ch] text-base leading-7 text-slate-200/80">
        Start and stop local recording from one focused control surface, with live status and
        clear operator feedback.
      </p>
    </div>

    <div
      aria-label="Recording status"
      class="grid gap-3 rounded-[22px] bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div class="flex items-center gap-2.5">
        <span class={`h-3 w-3 rounded-full ${statusDotClass}`}></span>
        <p class="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-300/65">
          Recorder status
        </p>
        {#if isLoading}
          <span class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.68rem] uppercase tracking-[0.1em] text-slate-300/60">
            Loading
          </span>
        {/if}
      </div>
      <p
        class="m-0 text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-[-0.04em]"
        role="status"
      >
        {statusLabel}
      </p>
      <p class="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-300/65">
        Latest saved recording
      </p>
      <p class="m-0 break-all leading-6 text-slate-100/90">{recordingFilename}</p>
    </div>

    <div
      aria-label="OBS connection status"
      class="grid gap-3 rounded-[22px] bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div class="flex items-center gap-2.5">
        <span class={`h-3 w-3 rounded-full ${obsStatusDotClass}`}></span>
        <p class="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-300/65">
          OBS websocket
        </p>
      </div>
      <p class="m-0 text-[1.15rem] font-semibold tracking-[-0.03em]">{obsStatusLabel}</p>
      <p class="m-0 break-all text-sm leading-6 text-slate-200/80">{obsConnectionStatus.url}</p>
      <p class="m-0 text-sm leading-6 text-slate-200/80">{obsConnectionStatus.message}</p>
    </div>
  </section>

  <section
    aria-label="Recording actions"
    class="grid gap-5 rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:p-7"
  >
    <div class="grid gap-2">
      <h2 class="m-0 text-[1.4rem] font-semibold tracking-[-0.03em]">Actions</h2>
      <p class="m-0 leading-6 text-slate-200/75">
        Use the controls below to manage the current OBS recording session.
      </p>
    </div>

    {#if obsScenes.length > 0}
      <div class="grid gap-2">
        <label class="text-sm text-slate-300/65 uppercase tracking-[0.12em]">Scene</label>
        <select
          on:change={(e) => {handleSwitchScene((e.target as HTMLSelectElement).value)}}
          class="rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
        >
          {#each obsScenes as scene}
            <option value={scene}>{scene}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="grid gap-4 md:grid-cols-2">
      <button
        class="min-h-[124px] rounded-[22px] bg-gradient-to-br from-amber-300 to-orange-400 p-5 text-left text-[1.05rem] font-bold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_18px_40px_rgba(0,0,0,0.28)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
        type="button"
        disabled={!canStart}
        on:click={handleStartRecording}
      >
        Start recording
      </button>
      <button
        class="min-h-[124px] rounded-[22px] bg-gradient-to-br from-sky-300 to-indigo-400 p-5 text-left text-[1.05rem] font-bold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_18px_40px_rgba(0,0,0,0.28)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
        type="button"
        disabled={!canStop}
        on:click={handleStopRecording}
      >
        Stop recording
      </button>
    </div>

    {#if showAlert}
      <p
        class="m-0 rounded-2xl border border-orange-400/30 bg-orange-500/15 px-4 py-3 text-orange-100"
        role="alert"
      >
        {alertMessage}
      </p>
    {/if}

    {#if connectionError !== ''}
      <p
        class="m-0 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-sky-100"
        role="alert"
      >
        {connectionError}
      </p>
    {/if}
  </section>
</main>
