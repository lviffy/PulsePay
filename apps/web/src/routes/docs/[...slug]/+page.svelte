<script lang="ts">
	import type { PageData } from './$types';
	import DocPage from '$lib/components/DocPage.svelte';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<DocPage {data} />
