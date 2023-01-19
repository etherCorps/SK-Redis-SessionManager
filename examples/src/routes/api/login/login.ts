import { fail, json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { sessionManger } from "$lib/session";

export const POST = (async ({ request, locals, cookies }) => {

  const { email, password } = await request.json();
  if (
    email !== "shivam@example.com" ||
    password !== "Shivam@Meena"
  ) {
    return fail( 400, {
      data: { email, password },
      message: "Invalid credentials"
    } );
  }
  const { data, error, message } = await sessionManger.createNewSession( cookies, {
    email
  } );
  if (error) {
    console.log( message );
    return fail( 400, {
      data: { email, password },
      message
    } );
  }
  return json( { success: true, message } );
}) satisfies RequestHandler;
