<script lang="ts">
  type Props = {
    label: string;
    disabled?: boolean | undefined;
    onclick?: () => void;
    variant?: 'start' | 'stop';
  };

  let { label, disabled, onclick, variant = 'start' }: Props = $props();

  const variants = {
    start: 'from-amber-300 to-orange-400',
    stop: 'from-sky-300 to-indigo-400',
  };
</script>

<button
  class="min-h-[124px] rounded-[22px] bg-gradient-to-br {variants[
    variant
  ]} p-5 text-left text-[1.05rem] font-bold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_18px_40px_rgba(0,0,0,0.28)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
  type="button"
  {disabled}
  {onclick}
>
  {label}
</button>
