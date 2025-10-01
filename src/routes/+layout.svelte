<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import WorldMap from '$lib/components/WorldMap.svelte';
	import SidebarItem from '$lib/components/SidebarItem.svelte';
	import StyledButton from '$lib/components/StyledButton.svelte';

	let { data, children } = $props();

	let mapData: ArrayBuffer | undefined = $state(undefined);

	const fetchMapData = async () => {
		const data = await fetch('/api/map');
		if (data.ok) {
			mapData = await data.arrayBuffer();
		}
	};

	onMount(() => {
		if (data.session) {
			fetchMapData();
		}
	});
</script>

<div class="h-dvh w-dvw">
	{#if !data.session}
		<div class="flex size-full flex-col items-center justify-center">
			<p class="text-3xl font-bold">Nations</p>
			<p class="mb-4">Sign in to start playing.</p>

			<StyledButton
				class="bg-[#5865F2]!"
				onclick={() => authClient.signIn.social({ provider: 'discord' })}
			>
				Sign in with <b>Discord</b>
			</StyledButton>
		</div>
	{:else}
		<div class="flex h-full w-fit">
			<div class="z-10 h-dvh w-fit overflow-y-auto border-r-2 border-neutral-950 bg-cream p-4">
				{@render children?.()}
			</div>

			<div class="z-10 flex h-full min-w-fit grow flex-col gap-y-2 p-2.5">
				<SidebarItem class="justify-self-end" label="Options" href="/options" />
				{#if page.url.pathname !== '/'}
					<a
						transition:fly={{ duration: 100, x: -20 }}
						href={resolve('/')}
						class="font-bold text-cream text-shadow-neutral-950 text-shadow-xs"
					>
						← Back
					</a>
				{/if}
			</div>

			<WorldMap class="absolute inset-0 size-full" data={mapData} />
		</div>
	{/if}
</div>
