import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const formatTime = (iso: string, locale: string): string =>
  new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (iso: string, locale: string): string =>
  new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
