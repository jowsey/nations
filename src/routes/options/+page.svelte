<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import StyledButton from '$lib/components/StyledButton.svelte';

	let { data } = $props();

	const signOut = async () => {
		await authClient.signOut();
		invalidate('app:authed'); // checked in +layout.server.ts
	};
</script>

<div class="w-80">
	<p>You're logged in as <b>{data.user?.name}</b></p>
	<StyledButton class="mt-2" onclick={signOut}>Log Out</StyledButton>
</div>
