"use server";

/**
 * Profile edits. Same conventions as the auth actions: validation here,
 * errors as message keys, and the typed values echoed back on failure so the
 * form does not lose them.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createSession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { getDB, getPhotos } from "@/lib/cf";
import { coerceLocale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";
import { MAX_PHOTO_BYTES, R2_PREFIX, detectPhotoType, newObjectName, r2Key } from "@/lib/photos";
import { field } from "@/lib/utils";

export interface ProfileState {
  ok?: boolean;
  error?: MessageKey;
  values?: { fullName: string; city: string; bio: string };
}

const MAX_NAME = 80;
const MAX_CITY = 80;
const MAX_BIO = 500;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

export async function updateProfileAction(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireUser(locale, "/profile");

  const fullName = field(form, "fullName").replace(/\s+/g, " ");
  const city = field(form, "city").slice(0, MAX_CITY);
  const bio = field(form, "bio").slice(0, MAX_BIO);
  const values = { fullName, city, bio };

  if (fullName.length < 2 || fullName.length > MAX_NAME) {
    return { error: "error.nameRequired", values };
  }

  const db = await getDB();
  await db
    .prepare(
      `UPDATE users SET full_name = ?, city = ?, bio = ?, updated_at = datetime('now')
        WHERE id = ?`,
    )
    .bind(fullName, city || null, bio || null, user.id)
    .run();

  // The name shows in the header, the host dashboard and on listings.
  revalidatePath("/", "layout");
  return { ok: true, values };
}

/**
 * Replaces the profile photo. The format comes from the bytes, never from the
 * client's MIME type, and the previous object is removed only after the row
 * points at the new one, so a failure never leaves a broken avatar.
 */
export async function updateAvatarAction(
  form: FormData,
): Promise<{ ok: boolean; error?: MessageKey }> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireUser(locale, "/profile");

  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "error.uploadFailed" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectPhotoType(bytes);
  if (!format) return { ok: false, error: "error.uploadFailed" };

  const db = await getDB();
  const bucket = await getPhotos();
  const previous = await db
    .prepare("SELECT avatar_key FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ avatar_key: string | null }>();

  const name = newObjectName("avatar", user.id, `avatar.${format.extension}`);
  await bucket.put(name, bytes, { httpMetadata: { contentType: format.contentType } });

  try {
    await db
      .prepare("UPDATE users SET avatar_key = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(r2Key(name), user.id)
      .run();
  } catch (error) {
    await bucket.delete(name).catch(() => undefined);
    throw error;
  }

  const old = previous?.avatar_key;
  if (old?.startsWith(R2_PREFIX)) {
    // A stranded object is a cleanup job, not an error for the user.
    await bucket.delete(old.slice(R2_PREFIX.length)).catch(() => undefined);
  }

  // The avatar shows in the header on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface PasswordState {
  ok?: boolean;
  error?: MessageKey;
}

/**
 * Changes the password after checking the current one. Every session is
 * revoked, then this device gets a fresh one: if the old password leaked,
 * whoever used it is signed out, and the person changing it is not.
 */
export async function changePasswordAction(
  _prev: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireUser(locale, "/profile");

  const current = field(form, "currentPassword");
  const next = field(form, "newPassword");
  const confirm = field(form, "confirmPassword");

  if (!current) return { error: "error.required" };
  if (next.length < MIN_PASSWORD) return { error: "error.passwordShort" };
  if (next.length > MAX_PASSWORD) return { error: "error.passwordLong" };
  if (confirm !== next) return { error: "error.passwordMismatch" };

  const db = await getDB();
  const row = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string }>();
  if (!row || current.length > MAX_PASSWORD || !(await verifyPassword(current, row.password_hash))) {
    return { error: "error.wrongPassword" };
  }

  const hash = await hashPassword(next);
  await db.batch([
    db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, user.id),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
  ]);

  const store = await headers();
  await createSession(user.id, store.get("user-agent"));

  return { ok: true };
}
