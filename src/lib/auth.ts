import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";

/**
 * Single source of truth for "who is logged in and which school/role do
 * they belong to". Every server component/action that used to read
 * DEMO_SCHOOL_ID from env now reads it from the session instead - so
 * multi-tenancy is enforced by who's logged in, not a hardcoded value.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.email, email),
        });
        if (!user) return null;

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
        };
      },
    }),
  ],
  callbacks: {
    // Runs on sign-in and on every subsequent request that reads the JWT -
    // this is what carries role/schoolId into the token itself.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.schoolId = (user as { schoolId: string }).schoolId;
      }
      return token;
    },
    // Copies the JWT fields onto the session object components/actions
    // actually read via auth().
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.schoolId = token.schoolId as string;
      }
      return session;
    },
  },
});
