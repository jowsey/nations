<script lang="ts">
	import { page } from '$app/state';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	interface Props extends HTMLAnchorAttributes {
		label: string;
		href: string;
	}

	let { label, href, ...attribs }: Props = $props();
	const active = $derived(page.url.pathname === href);
</script>

<a
	{...attribs}
	{href}
	aria-current={active ? 'page' : undefined}
	class={[
		'rounded-smooth max-w-fit rounded-full bg-cream px-4 py-1 transition-all hover:translate-x-1',
		active && 'font-bold outline-2 outline-neutral-950',
		attribs.class
	]}
>
	{label}
</a>
