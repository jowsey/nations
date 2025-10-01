<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let { children, ...attribs }: HTMLButtonAttributes = $props();
</script>

<button
	{...attribs}
	class={[
		'rounded-smooth cursor-pointer rounded-full bg-grass px-4 py-1 text-neutral-50 hover:brightness-105',
		attribs.class
	]}
>
	{@render children?.()}
</button>
