<svelte:head>
  <title>Recording Control</title>
</svelte:head>

<script lang="ts">
  const status = 'Idle';
</script>

<main>
  <h1>Recording Control</h1>

  <section aria-label="Recording status">
    <p role="status">{status}</p>
    <p>Current filename: not recording</p>
  </section>

  <section aria-label="Recording actions">
    <button type="button">Start recording</button>
    <button type="button">Stop recording</button>
  </section>
</main>
