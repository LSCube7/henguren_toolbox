import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { resolveRequestLocale } from "./locale-detection";

export const getRequestLocale = cache(async () => resolveRequestLocale((await headers()).get("accept-language")));
