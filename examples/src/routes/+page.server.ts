import type { Actions } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { sessionManger } from './session';
import type { PageServerLoad } from './$types';

export let ssr = true;
export const load: PageServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		isAuthenticated: locals.isUserLoggedIn
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
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

		const { data, error, message } = await sessionManger.setNewSession(cookies, {
			email: formData.get('email')
		});
		if (error) {
			console.log(message);
			return fail(400, {
				data: Object.fromEntries(formData),
				message
			});
		}
		return { success: true };
	}
};
