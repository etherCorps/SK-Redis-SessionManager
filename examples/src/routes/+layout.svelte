<script>
	import '../app.css';
	import { Toaster } from 'svelte-french-toast';
</script>

<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>
<div class="bg-gray-700">
	<Toaster />
	<slot />
</div>
