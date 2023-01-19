<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';
	import toast from 'svelte-french-toast';
	import { onMount } from 'svelte';
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
		const response = await fetch('/logout', {
			method: 'POST',
			body: JSON.stringify({ email: data.user.email }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const responseData = await response.json();
		show = responseData.loggedIn;
	};
</script>

<div class="h-screen font-sans login bg-cover">
	<div class="container mx-auto h-full flex flex-1 justify-center items-center">
		<div class="w-full max-w-lg">
			{#if show}
				<div class="flex items-center justify-center min-h-screen">
					<div
						class="p-4 items-center justify-center w-[680px] rounded-xl group sm:flex space-x-6 bg-white bg-opacity-50 shadow-xl hover:rounded-2xl"
					>
						<img
							class="mx-auto w-full block w-4/12 h-40 rounded-lg"
							alt="art cover"
							loading="lazy"
							src="https://picsum.photos/seed/2/2000/1000"
						/>
						<div class="sm:w-8/12 pl-0 p-5">
							<div class="space-y-2">
								<div class="space-y-4">
									<h4 class="text-md font-semibold text-cyan-900 text-justify">
										You are currently logged in with {data.user.email}
									</h4>
								</div>
								<div class="flex items-center space-x-4 justify-between">
									<div class="flex gap-3 space-y-1">
										<img
											src="https://api.dicebear.com/5.x/lorelei/svg"
											class="rounded-full h-8 w-8"
										/>
										<span class="text-sm">{data.user.email}</span>
									</div>
								</div>
								<div class="flex items-center space-x-4 justify-between">
									<div class="text-grey-500 flex flex-row space-x-1  my-4">
										<svg
											stroke="currentColor"
											fill="none"
											stroke-width="0"
											viewBox="0 0 24 24"
											height="1em"
											width="1em"
											xmlns="http://www.w3.org/2000/svg"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
											/></svg
										>
										<p class="text-xs">Session valid for 10 Min</p>
									</div>
									<div class="flex flex-row space-x-1">
										<button
											on:click={() => logoutUser()}
											class="bg-green-500 shadow-lg shadow- shadow-green-600 text-white cursor-pointer px-3 text-center justify-center items-center py-2 rounded-xl flex space-x-2 flex-row"
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
											<span>Logout</span>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<!--{$page.data.user.email}-->
			{:else}
				<div class="leading-loose">
					<form
						class="max-w-sm m-4 p-10 bg-white bg-opacity-25 rounded shadow-xl"
						method="post"
						use:enhance
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
							<label class="block  text-sm text-white">Password</label>
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
