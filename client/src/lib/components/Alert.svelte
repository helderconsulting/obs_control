<script lang="ts">
  type Props = {
    message?: string;
    type?: 'error' | 'info';
  };

  let { message, type = 'error' }: Props = $props();

  const classes = {
    error: 'border-orange-400/30 bg-orange-500/15 text-orange-100',
    info: 'border-sky-400/30 bg-sky-500/15 text-sky-100',
  };
</script>

{#if message}
  <p class="m-0 rounded-2xl border px-4 py-3 {classes[type]}" role="alert">
    {message}
  </p>
{/if}
