<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let { children, ...attribs }: HTMLButtonAttributes = $props();
</script>

<button
	{...attribs}
	class={[
		'rounded-smooth cursor-pointer rounded-full bg-neutral-950 px-4 py-1 text-neutral-50 hover:bg-neutral-900',
		attribs.class
	]}
>
	{@render children?.()}
</button>
