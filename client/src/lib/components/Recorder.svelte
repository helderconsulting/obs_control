<script lang="ts">
  import SceneSelector from './SceneSelector.svelte';
  import RecordButton from './RecordButton.svelte';
  import Alert from './Alert.svelte';

  let { 
    status, 
    scenes, 
    onStart, 
    onStop, 
    onSwitchScene,
    error,
    alert
  } = $props();

  let canStart = $derived(status === 'idle' || status === 'error');
  let canStop = $derived(status === 'recording');
</script>

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

  <SceneSelector {scenes} onchange={onSwitchScene} />

  <div class="grid gap-4 md:grid-cols-2">
    <RecordButton 
      label="Start recording" 
      variant="start" 
      disabled={!canStart} 
      onclick={onStart} 
    />
    <RecordButton 
      label="Stop recording" 
      variant="stop" 
      disabled={!canStop} 
      onclick={onStop} 
    />
  </div>

  <Alert message={alert} type="error" />
  <Alert message={error} type="info" />
</section>
