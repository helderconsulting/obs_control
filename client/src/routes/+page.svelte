<script lang="ts">
  import { onMount } from 'svelte';
  import { RecordingState } from '$lib/stores/recording.svelte';
  import Header from '$lib/components/Header.svelte';
  import StatusCard from '$lib/components/StatusCard.svelte';
  import Recorder from '$lib/components/Recorder.svelte';

  const state = new RecordingState();

  const statusLabelByStatus: Record<string, string> = {
    idle: 'Idle',
    starting: 'Starting',
    recording: 'Recording',
    stopping: 'Stopping',
    error: 'Error',
  };

  let recordingFilename = $derived(
    state.recording.lastRecordingFilename !== null
      ? state.recording.lastRecordingFilename
      : state.recording.status === 'recording' ||
          state.recording.status === 'starting' ||
          state.recording.status === 'stopping'
        ? 'OBS reports the recording file after the recording stops.'
        : 'No saved recording yet',
  );

  let statusLabel = $derived(statusLabelByStatus[state.recording.status]);
  let obsStatusLabel = $derived(
    state.obsConnectionStatus.status === 'connected' ? 'Connected to OBS' : 'OBS disconnected',
  );

  onMount(() => {
    state.init();
    return () => state.destroy();
  });
</script>

<svelte:head>
  <title>Recording Control</title>
</svelte:head>

<main
  class="mx-auto grid min-h-screen max-w-6xl gap-6 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.18),transparent_30%),linear-gradient(160deg,#0d1528_0%,#101a30_55%,#152441_100%)] px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8 lg:py-12"
>
  <section
    class="grid gap-6 rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:grid-cols-[1.6fr_0.9fr] lg:p-7"
  >
    <Header />

    <StatusCard title="Recorder status" status={state.recording.status}>
      {#snippet header()}
        {#if state.isLoading}
          <span
            class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.68rem] uppercase tracking-[0.1em] text-slate-300/60"
          >
            Loading
          </span>
        {/if}
      {/snippet}

      <p class="m-0 text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-[-0.04em]" role="status">
        {statusLabel}
      </p>
      <p class="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-300/65">
        Latest saved recording
      </p>
      <p class="m-0 break-all leading-6 text-slate-100/90">{recordingFilename}</p>
    </StatusCard>

    <StatusCard
      title="OBS websocket"
      status={state.obsConnectionStatus.status === 'connected' ? 'connected' : 'disconnected'}
    >
      <p class="m-0 text-[1.15rem] font-semibold tracking-[-0.03em]">{obsStatusLabel}</p>
      <p class="m-0 break-all text-sm leading-6 text-slate-200/80">
        {state.obsConnectionStatus.url}
      </p>
      <p class="m-0 text-sm leading-6 text-slate-200/80">{state.obsConnectionStatus.message}</p>
    </StatusCard>
  </section>

  <Recorder
    status={state.recording.status}
    scenes={state.obsScenes}
    onStart={() => state.startRecording()}
    onStop={() => state.stopRecording()}
    onSwitchScene={(name) => state.switchScene(name)}
    alert={state.recording.status === 'error' ? state.recording.message : ''}
    error={state.connectionError}
  />
</main>
