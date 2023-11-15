import type { Actions } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { sessionManager } from '$lib/session';
import type { PageServerLoad } from './$types';

export let ssr = true;
export const load: PageServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		isAuthenticated: locals.isUserLoggedIn
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		if (
			formData.get('email') !== 'shivam@example.com' ||
			formData.get('password') !== 'Shivam@Meena'
		) {
			return fail(400, {
				data: Object.fromEntries(formData),
				message: 'Check form for errors'
			});
		}

		const { data, error, message } = await sessionManager.createSession(
			cookies,
			{ email: formData.get('email') },
			'1'
		);
		if (error) {
			console.log(message);
			return fail(400, {
				data: Object.fromEntries(formData),
				message
			});
		}
		console.log(data);
		return { success: true, message };
	}
};
