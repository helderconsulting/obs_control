<script lang="ts">
  let { scenes, onchange } = $props();
</script>

{#if scenes.length > 0}
  <div class="grid gap-2">
    <label for="scene-selector" class="text-[0.72rem] text-slate-300/65 uppercase tracking-[0.12em]">Scene</label>
    <select
      id="scene-selector"
      onchange={(e) => onchange((e.target as HTMLSelectElement).value)}
      class="rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-300/50"
    >
      {#each scenes as scene}
        <option value={scene}>{scene}</option>
      {/each}
    </select>
  </div>
{/if}
