<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Application, Assets, Container, Sprite } from 'pixi.js';
	import { authClient } from '$lib/auth-client';
	import SidebarItem from '$lib/components/SidebarItem.svelte';
	import StyledButton from '$lib/components/StyledButton.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';

	let { data, children } = $props();

	let worldCanvas: HTMLCanvasElement | null = $state(null);
	let app: Application | undefined;

	onMount(() => {
		(async () => {
			if (!worldCanvas || !data.session) return; // todo stick this in a component so it only renders when authed

			app = new Application();
			await app.init({ background: '#25acf5', resizeTo: worldCanvas, canvas: worldCanvas });

			const container = new Container();
			app.stage.addChild(container);

			const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
			for (let i = 0; i < 25; i++) {
				const bunny = new Sprite(texture);

				bunny.x = (i % 5) * 40;
				bunny.y = Math.floor(i / 5) * 40;
				container.addChild(bunny);
			}

			container.x = app.screen.width / 2;
			container.y = app.screen.height / 2;

			container.pivot.x = container.width / 2;
			container.pivot.y = container.height / 2;

			app.ticker.add((time) => {
				container.rotation -= 0.01 * time.deltaTime;
			});
		})();

		return () => {
			app?.destroy();
		};
	});
</script>

<div class="h-dvh w-dvw">
	{#if !data.session}
		<div class="flex size-full flex-col items-center justify-center">
			<p class="text-3xl font-bold">Nations</p>
			<p class="mb-4">Log in to start playing.</p>

			<StyledButton onclick={() => authClient.signIn.social({ provider: 'discord' })}>
				Sign in with Discord
			</StyledButton>
		</div>
	{:else}
		<div class="flex size-full">
			<div class="h-dvh w-fit overflow-y-auto border-r-2 border-neutral-950 bg-cream p-4">
				{@render children?.()}
			</div>

			<div class="flex h-full min-w-fit grow flex-col gap-y-2 p-2.5">
				<SidebarItem class="justify-self-end" label="Options" href="/options" />
				{#if page.url.pathname !== '/'}
					<a
						transition:fly={{ duration: 100, x: -20 }}
						href={resolve('/')}
						class="text-shadow-950 font-bold text-cream text-shadow-sm"
					>
						← Back
					</a>
				{/if}
			</div>

			<canvas bind:this={worldCanvas} class="absolute inset-0 -z-10 size-full"></canvas>
		</div>
	{/if}
</div>
