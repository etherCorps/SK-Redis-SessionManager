import {fail, json, redirect, type RequestHandler} from "@sveltejs/kit";
import {sessionManager} from "$lib/session";

export const POST = (async ({ request, locals, cookies }) => {
    if (locals && locals.isUserLoggedIn) {
        const { email, password } = await request.json();
        if (
            email !== "shivam@example.com" ||
            password !== "Shivam@Meena"
        ) {
            return fail( 400, {
                email, password ,
                message: "Invalid credentials"
            } );
        }
        const { error, message } = await sessionManager.createNewSession( cookies, {
            email
        } );
        if (error) {
            return fail( 400, {
                email, password,
                message
            } );
        }
        return json( { success: true, message } );
    }
    throw redirect(302, '/');
}) satisfies RequestHandler;
