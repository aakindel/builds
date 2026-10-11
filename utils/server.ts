import { cookies } from "next/headers";
import superjson from "superjson";
import { hasOnlyDigits } from ".";

export async function getAppCookie<
  T = void,
  U extends T = T & (boolean | number | object | string),
>({
  cookieName,
  defaultValue,
}: {
  cookieName: string | undefined;
  defaultValue: U;
}): Promise<U> {
  if (!cookieName) {
    return defaultValue;
  }

  const cookieStore = await cookies();

  if (typeof defaultValue === "function") {
    throw new Error(
      `ERROR in "getAppCookie": could not get default value for ${cookieName} cookie! Import the default value variable from a server file, not a "use client" file.`
    );
  }

  const cookieValueString = cookieStore.get(cookieName)?.value;

  if (typeof defaultValue === "boolean") {
    if (cookieValueString) {
      // @ts-expect-error : type is narrowed, so return type is U
      return cookieValueString === "true";
    }
    return defaultValue;
  }

  if (typeof defaultValue === "number") {
    if (cookieValueString && hasOnlyDigits(cookieValueString)) {
      // @ts-expect-error : type is narrowed, so return type is U
      return Number(cookieValueString);
    }
    return defaultValue;
  }

  if (typeof defaultValue === "object") {
    if (cookieValueString) {
      return superjson.parse<U>(cookieValueString);
    }
    return defaultValue;
  }

  // default case: typeof defaultValue === "string"
  if (cookieValueString !== undefined) {
    // @ts-expect-error : type is narrowed, so return type is U
    return cookieValueString;
  }
  return defaultValue;
}
