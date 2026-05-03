<script lang="ts">
  import StatusIndicator from './StatusIndicator.svelte';

  let { title, status, header, children } = $props();
</script>

<div
  aria-label={title}
  class="grid gap-3 rounded-[22px] bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
>
  <div class="flex items-center gap-2.5">
    <StatusIndicator {status} />
    <p class="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-300/65">
      {title}
    </p>
    {@render header?.()}
  </div>
  {@render children?.()}
</div>
