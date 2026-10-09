"use client";

import { useRef, useTransition } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { setProviderPhotoAction } from "@/actions/providers";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { isAcceptedPhotoType, MAX_PHOTO_BYTES, PHOTO_ACCEPT } from "@/lib/photos";
import type { Locale } from "@/lib/types";

/** The business photo on the edit page, with a button to replace it. */
export function ProviderPhoto({
  providerId,
  locale,
  src,
  name,
}: {
  providerId: string;
  locale: Locale;
  src: string;
  name: string;
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
    form.set("providerId", providerId);
    form.set("photo", file);

    startTransition(async () => {
      try {
        const res = await setProviderPhotoAction(form);
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} className="aspect-[21/9] w-full bg-muted object-cover" />
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("provider.photo")}</p>
          <p className="text-xs text-muted-foreground">{t("provider.photoHint")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <Camera aria-hidden />
          {t("profile.changePhoto")}
        </Button>
      </div>
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
