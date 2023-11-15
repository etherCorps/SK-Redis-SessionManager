<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';
	import toast from 'svelte-french-toast';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	let expireTime;

	export let form: ActionData;
	$: if (form && form.data && form.message) {
		toast.error(form.message);
	} else if (form?.success) {
		toast.success('Logged in successfully');
	}

	export let data: PageServerData;
	$: show = data.isAuthenticated;

	const logoutUser = async () => {
		const response = await fetch('/api/logout', {
			method: 'POST',
			body: JSON.stringify({ email: data.user.email }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const responseData = await response.json();
		show = responseData.loggedIn;
	};

	const updateCookieData = async () => {
		const response = await fetch('/api/updateCookieData', {
			method: 'POST',
			body: JSON.stringify({ name: 'The Ether' }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const responseData = await response.json();
		console.log(responseData.sessionData);
		if (responseData.success) {
			toast.success(
				`Cookie Data is successfully updated and new session data in redis is ${responseData.sessionData}`
			);
		} else {
			toast.error(responseData.message);
		}
		await invalidateAll();
	};
</script>

<div class="h-screen font-sans login bg-cover">
	<div class="container mx-auto h-full flex flex-1 justify-center items-center">
		<div class="w-full max-w-lg">
			{#if show}
				<div class="relative mx-auto max-w-md overflow-hidden rounded-lg bg-white shadow">
					<div>
						<img
							src="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80"
							class="w-full object-cover"
							alt=""
						/>
					</div>
					<div class="absolute inset-0 z-10 bg-gradient-to-t from-black" />
					<div class="absolute inset-x-0 bottom-0 z-20 p-4">
						<p class="mb-1 text-sm text-white text-opacity-80">
							{#if $page.data.user?.name} {$page.data.user.name} • {/if}
							<time>Session is valid for only 10 Mins</time>
						</p>
						<h3 class="text-xl font-medium text-white">
							{#if $page.data.user?.email} {$page.data.user.email} {/if}
						</h3>
						<p class="mt-1 text-white text-opacity-80">
							You are testing for sveltekit redis session manager by ethercorps.
						</p>
					</div>
				</div>
				<div class="flex items-center justify-center mt-2">
					<div
						class="inline-flex -space-x-0 divide-x divide-gray-900 overflow-hidden rounded-lg border border-gray-900 shadow-sm"
					>
						<button
							on:click={() => updateCookieData()}
							type="button"
							class="inline-flex items-center bg-amber-500 px-4 py-2.5 text-center text-sm font-medium text-amber-100 shadow-sm hover:bg-amber-100 hover:text-amber-900 transition easy-in-out duration-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="mr-2 h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
								/>
							</svg>

							Update Cookie Data
						</button>
						<button
							on:click={() => logoutUser()}
							type="button"
							class="inline-flex items-center bg-red-500 px-4 py-2.5 text-center text-sm font-medium text-red-100 shadow-sm hover:bg-red-100 hover:text-red-900 transition easy-in-out duration-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-6 h-6"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
								/>
							</svg>
							Logout
						</button>
					</div>
				</div>
			{:else}
				<div class="leading-loose">
					<form
						class="max-w-sm m-4 p-10 bg-white bg-opacity-25 rounded shadow-xl"
						method="post"
						use:enhance={() => {
							return async ({ result, update }) => {
								await invalidateAll();
							};
						}}
					>
						<p class="text-white font-medium text-center text-lg font-bold">
							SvelteKit Redis Session Login Example
						</p>
						<div class="">
							<label class="block text-sm text-white" for="email">E-mail</label>
							<input
								class="w-full px-5 py-1 text-gray-700 bg-gray-300 rounded focus:outline-none focus:bg-white"
								type="email"
								name="email"
								id="email"
								value={'shivam@example.com'}
								placeholder="shivam@example.com"
								aria-label="email"
								required
							/>
						</div>
						<div class="mt-2">
							<label class="block text-sm text-white">Password</label>
							<input
								class="w-full px-5 py-1 text-gray-700 bg-gray-300 rounded focus:outline-none focus:bg-white"
								value="Shivam@Meena"
								type="password"
								name="password"
								id="password"
								placeholder="Shivam@Meena"
								arial-label="password"
								required
							/>
						</div>

						<div class="mt-4 items-center flex justify-center">
							<button
								class="px-4 py-1 text-white font-light tracking-wider bg-gray-900 hover:bg-gray-800 rounded"
								type="submit">Login</button
							>
						</div>
					</form>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.login {
		/*background: url(https://tailwindadmin.netlify.app/dist/images/login-new.jpeg);*/
		background: url('http://bit.ly/2gPLxZ4');
		background-repeat: no-repeat;
		background-size: cover;
	}
</style>
