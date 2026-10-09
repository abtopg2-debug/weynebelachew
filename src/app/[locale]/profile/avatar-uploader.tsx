"use client";

import { useRef, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateAvatarAction } from "@/actions/profile";
import { UserAvatar } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n/client";
import { isAcceptedPhotoType, MAX_PHOTO_BYTES, PHOTO_ACCEPT } from "@/lib/photos";
import type { Locale } from "@/lib/types";

/**
 * The profile avatar with a camera button on it. Tapping the button opens the
 * file picker; the photo uploads straight away and the layout refreshes, so
 * the header avatar changes too.
 */
export function AvatarUploader({
  locale,
  name,
  src,
}: {
  locale: Locale;
  name: string;
  src: string | null;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    if (input.current) input.current.value = "";
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedPhotoType(file.type)) {
      toast.error(t("error.uploadFailed"));
      reset();
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(t("error.fileTooBig", { size: `${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB` }));
      reset();
      return;
    }

    const form = new FormData();
    form.set("locale", locale);
    form.set("photo", file);

    startTransition(async () => {
      try {
        const res = await updateAvatarAction(form);
        if (res.ok) toast.success(t("profile.photoUpdated"));
        else toast.error(t(res.error ?? "error.uploadFailed"));
      } catch {
        toast.error(t("error.uploadFailed"));
      } finally {
        reset();
      }
    });
  };

  return (
    <div className="relative shrink-0">
      <UserAvatar
        name={name}
        src={src}
        className="size-20 border-4 border-card text-xl shadow-card"
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        aria-label={t("profile.changePhoto")}
        title={t("profile.changePhoto")}
        className="absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="size-4" aria-hidden />
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
