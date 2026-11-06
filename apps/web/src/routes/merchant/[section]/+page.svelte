<script lang="ts">
	import { page } from '$app/state';
	import MerchantDashboard from '$lib/components/MerchantDashboard.svelte';

	const section = $derived(page.params.section || 'invoices');
</script>

<MerchantDashboard {section} />

