<script lang="ts">
  let { status = 'idle' } = $props();

  const classes: Record<string, string> = {
    recording: 'bg-orange-500 shadow-[0_0_0_6px_rgba(249,115,22,0.18)]',
    starting: 'bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,0.16)]',
    stopping: 'bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,0.16)]',
    idle: 'bg-slate-400 shadow-[0_0_0_6px_rgba(148,163,184,0.12)]',
    error: 'bg-slate-400 shadow-[0_0_0_6px_rgba(148,163,184,0.12)]',
    connected: 'bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.16)]',
    disconnected: 'bg-rose-400 shadow-[0_0_0_6px_rgba(251,113,133,0.16)]',
  };
</script>

<span class="h-3 w-3 rounded-full {classes[status] || classes.idle}"></span>
