import { enUS } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";

export const supportedLocales = ["zh-CN", "en-US"] as const;

export type AppLocale = (typeof supportedLocales)[number];
export type MessageKey = keyof typeof zhCN;
export type MessageValues = Record<string, string | number>;

export const defaultLocale: AppLocale = "zh-CN";

const dictionaries: Record<AppLocale, Record<MessageKey, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && supportedLocales.includes(value as AppLocale);
}

export function translate(locale: AppLocale, key: MessageKey, values?: MessageValues) {
  const message = dictionaries[locale][key] ?? dictionaries[defaultLocale][key];
  if (!values) return message;

  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
  );
}
