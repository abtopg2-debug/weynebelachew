"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { changePasswordAction, type PasswordState } from "@/actions/profile";
import { PasswordInput } from "@/components/ui/auth-inputs";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/types";

/** Current password plus the new one twice. The form clears itself after submit. */
export function PasswordForm({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success(t("profile.passwordChanged"));
  }, [state, t]);

  const labels = { showLabel: t("auth.showPassword"), hideLabel: t("auth.hidePassword") };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <Field
        label={t("auth.currentPassword")}
        htmlFor="current-password"
        required
        error={state.error ? t(state.error) : null}
      >
        <PasswordInput
          id="current-password"
          name="currentPassword"
          autoComplete="current-password"
          maxLength={128}
          required
          {...labels}
        />
      </Field>

      <Field label={t("auth.newPassword")} htmlFor="new-password" required hint={t("auth.passwordHint")}>
        <PasswordInput
          id="new-password"
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          {...labels}
        />
      </Field>

      <Field label={t("auth.confirmPassword")} htmlFor="confirm-new-password" required>
        <PasswordInput
          id="confirm-new-password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          {...labels}
        />
      </Field>

      <Button type="submit" loading={pending}>
        {t("profile.changePassword")}
      </Button>
    </form>
  );
}
