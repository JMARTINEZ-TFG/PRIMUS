import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getDb } from "../db.server";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
} from "../session.server";
import { sendVerificationEmail, sendPasswordResetEmail, sendUnlockApprovedEmail } from "../email.server";

const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener una mayúscula")
    .regex(/[a-z]/, "Debe contener una minúscula")
    .regex(/[0-9]/, "Debe contener un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener un carácter especial"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator(RegisterSchema)
  .handler(async ({ data }) => {
    const db = getDb();

    const existing = await db.query(
      "SELECT id_usuario FROM usuario WHERE email = $1",
      [data.email],
    );
    if (existing.rows.length > 0) {
      throw new Error("EMAIL_TAKEN");
    }

    const hash = await bcrypt.hash(data.password, 12);
    const verificationToken = randomBytes(32).toString("hex");
    const result = await db.query(
      `INSERT INTO usuario (email, password_hash, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING id_usuario, email`,
      [data.email, hash, verificationToken],
    );

    const user = result.rows[0] as { id_usuario: number; email: string };
    await sendVerificationEmail(user.email, verificationToken);

    return { pendingVerification: true };
  });

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator(LoginSchema)
  .handler(async ({ data }) => {
    const db = getDb();

    const result = await db.query(
      "SELECT id_usuario, email, password_hash, failed_attempts, locked_until, is_admin, email_verified, last_login_at FROM usuario WHERE email = $1",
      [data.email],
    );

    if (result.rows.length === 0) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const user = result.rows[0] as {
      id_usuario: number;
      email: string;
      password_hash: string;
      failed_attempts: number;
      locked_until: Date | null;
      is_admin: boolean;
      email_verified: boolean;
      last_login_at: Date | null;
    };

    if (user.locked_until && user.locked_until > new Date()) {
      throw new Error("ACCOUNT_LOCKED");
    }

    if (!user.email_verified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      const newAttempts = (user.failed_attempts ?? 0) + 1;
      if (newAttempts >= 5) {
        await db.query(
          "UPDATE usuario SET failed_attempts = $1, locked_until = 'infinity'::timestamp WHERE id_usuario = $2",
          [newAttempts, user.id_usuario],
        );
        throw new Error("ACCOUNT_LOCKED");
      }
      await db.query(
        "UPDATE usuario SET failed_attempts = $1 WHERE id_usuario = $2",
        [newAttempts, user.id_usuario],
      );
      throw new Error("INVALID_CREDENTIALS");
    }

    const firstLogin = user.last_login_at === null;
    await db.query(
      "UPDATE usuario SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id_usuario = $1",
      [user.id_usuario],
    );

    const token = await createSessionToken({ userId: user.id_usuario, email: user.email });
    setSessionCookie(token);

    return { userId: user.id_usuario, email: user.email, isAdmin: user.is_admin, firstLogin };
  });

export const verifyEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await db.query<{ id_usuario: number }>(
      `SELECT id_usuario FROM usuario
       WHERE verification_token = $1
         AND verification_token_expires > NOW()
         AND email_verified = FALSE`,
      [data.token],
    );
    if (result.rows.length === 0) throw new Error("TOKEN_INVALID");
    await db.query(
      `UPDATE usuario
       SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL
       WHERE id_usuario = $1`,
      [result.rows[0].id_usuario],
    );
    return { ok: true };
  });

export const requestAccountUnlock = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const db = getDb();
    await db.query(
      "UPDATE usuario SET unlock_requested_at = NOW() WHERE email = $1 AND locked_until IS NOT NULL",
      [data.email],
    );
    return { ok: true };
  });

export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const db = getDb();
  const userRes = await db.query<{ is_admin: boolean }>(
    "SELECT is_admin FROM usuario WHERE id_usuario = $1",
    [session.userId],
  );
  if (!userRes.rows[0]?.is_admin) throw new Error("FORBIDDEN");
  const result = await db.query<{
    id_usuario: number;
    email: string;
    failed_attempts: number;
    unlock_requested_at: string;
  }>(
    `SELECT id_usuario, email, failed_attempts, unlock_requested_at::text
     FROM usuario
     WHERE unlock_requested_at IS NOT NULL
     ORDER BY unlock_requested_at ASC`,
  );
  return result.rows;
});

export const approveUnlock = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id_usuario: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const res = await db.query<{ email: string }>(
      "UPDATE usuario SET failed_attempts = 0, locked_until = NULL, unlock_requested_at = NULL WHERE id_usuario = $1 RETURNING email",
      [data.id_usuario],
    );
    if (res.rows[0]) {
      await sendUnlockApprovedEmail(res.rows[0].email);
    }
    return { ok: true };
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  clearSessionCookie();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  return getSession();
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const res = await db.query<{ id_usuario: number }>(
      "SELECT id_usuario FROM usuario WHERE email = $1 AND email_verified = TRUE",
      [data.email],
    );
    if (res.rows.length === 0) return { ok: true };
    const token = randomBytes(32).toString("hex");
    await db.query(
      "UPDATE usuario SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour' WHERE id_usuario = $2",
      [token, res.rows[0].id_usuario],
    );
    await sendPasswordResetEmail(data.email, token);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1), password: z.string().min(8) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const res = await db.query<{ id_usuario: number }>(
      `SELECT id_usuario FROM usuario
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [data.token],
    );
    if (res.rows.length === 0) throw new Error("TOKEN_INVALID");
    const hash = await bcrypt.hash(data.password, 12);
    await db.query(
      `UPDATE usuario
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL,
           failed_attempts = 0, locked_until = NULL
       WHERE id_usuario = $2`,
      [hash, res.rows[0].id_usuario],
    );
    return { ok: true };
  });
