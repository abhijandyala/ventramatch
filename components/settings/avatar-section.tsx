"use client";

import { useState } from "react";
import { AvatarUploader } from "@/components/profile/avatar-uploader";

/**
 * Thin client wrapper around AvatarUploader for the /settings page.
 *
 * Keeps the optimistic state local so the page server component doesn't
 * have to revalidate after every upload — the user sees the new photo
 * immediately. The router-cache catches up on the next navigation.
 */
export function AvatarSection({
  userId,
  name,
  initialSrc,
}: {
  userId: string;
  name: string | null;
  initialSrc: string | null;
}) {
  const [src, setSrc] = useState<string | null>(initialSrc);
  return (
    <AvatarUploader
      userId={userId}
      name={name}
      currentSrc={src}
      size="xl"
      onUpdated={({ src: next }) => setSrc(next)}
    />
  );
}
