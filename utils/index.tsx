import * as React from "react";
import { type AxiosError, type AxiosResponse } from "axios";
import { cn } from "cn";
import * as z from "zod";

// https://github.com/shadcn-ui/cn
export { cn };

/* object wrapper listed in tailwindCSS.classFunctions so
   tailwind intellisense works in object with class strings */
export function classObject<T extends Record<PropertyKey, unknown>>(value: T) {
  return value;
}

export function openUrlInNewTab(url: string): void {
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (newWindow) newWindow.opener = null;
}

export function withClass<Parts extends { main?: string; hover?: string }>(
  parts: Parts
) {
  return { ...parts, class: cn(parts.main, parts.hover) };
}

export function getVisibilityHiddenClass(condition: boolean) {
  return condition ? "invisible" : "";
}

export const getTrueOrUndefined = (value: boolean) => {
  return value ? true : undefined;
};

export function hasOnlyDigits(value: string) {
  return value.length ? /^-?\d+$/.test(value) : false;
}

export function handleUnusedVariables(...props: unknown[]) {
  return props;
}

export const isMac = () => {
  return typeof navigator != "undefined"
    ? /Mac|iP(hone|[oa]d)/.test(navigator.platform)
    : false;
};

export function getRegExp({
  pattern,
  flags,
  shouldResetLastIndex = true,
}: {
  pattern: RegExp;
  flags?: string;
  shouldResetLastIndex?: boolean;
}) {
  const innerRegExp = new RegExp(pattern, flags);
  const newRegExp = new RegExp(pattern, flags);
  newRegExp.exec = (execString: string) => {
    const execResult = innerRegExp.exec(execString);
    return shouldResetLastIndex
      ? new RegExp(pattern, flags).exec(execString)
      : execResult;
  };
  newRegExp.test = (testString: string) => {
    const testResult = innerRegExp.test(testString);
    return shouldResetLastIndex
      ? new RegExp(pattern, flags).test(testString)
      : testResult;
  };
  return newRegExp;
}

// used to prevent SSR attribute mismatch hydration warning
export function getAriaProps({
  id: outerId,
  htmlFor: outerHtmlFor,
  ariaControls: outerAriaControls,
  ariaLabelledby: outerAriaLabelledby,
  returns,
}: {
  id?: string;
  htmlFor?: string;
  ariaControls?: string;
  ariaLabelledby?: string;
  returns?: ("id" | "htmlFor" | "ariaControls" | "ariaLabelledby")[];
}) {
  const id = outerId ?? "aria-id";
  const htmlFor = outerHtmlFor ?? id;
  const ariaControls = outerAriaControls ?? id;
  const ariaLabelledby = outerAriaLabelledby ?? id;

  const propsByKey = {
    id: { id },
    htmlFor: { htmlFor },
    ariaControls: { "aria-controls": ariaControls },
    ariaLabelledby: { "aria-labelledby": ariaLabelledby },
  } as const;

  const keysToReturn =
    returns ?? (Object.keys(propsByKey) as (keyof typeof propsByKey)[]);

  // only return the keys specified by `returns` if `returns` is provided
  return keysToReturn.reduce(
    (acc, key) => ({ ...acc, ...propsByKey[key] }),
    {} as {
      id?: string;
      htmlFor?: string;
      "aria-controls"?: string;
      "aria-labelledby"?: string;
    }
  );
}

export function getNewLineStringWithBreakElements(newLineString: string) {
  return (
    <React.Fragment>
      {newLineString?.split("\n").map((item, index) => {
        return index === 0 ? (
          item
        ) : (
          <React.Fragment key={index}>
            <br />
            {item}
          </React.Fragment>
        );
      })}
    </React.Fragment>
  );
}

export function getZodEnumFromObjectKeys<T extends Record<string, unknown>>(
  obj: T
) {
  const keys = Object.keys(obj) as Extract<keyof T, string>[];
  return z.enum(
    keys as [Extract<keyof T, string>, ...Extract<keyof T, string>[]]
  );
}

export function getErrorMessageFromZodErrors({
  errors,
}: {
  errors: z.core.$ZodIssue[];
}) {
  const errorMessages = errors.map((error) => {
    if (error.code === "invalid_type") {
      return `Invalid type received: '${error}'.`;
    } else if (error.code === "unrecognized_keys") {
      return `Unrecognized key${error.keys.length > 1 ? "s" : ""} in object: ${error.keys.map((errorKey) => `'${errorKey}'`).join(",")}.`;
    }
    return error.message;
  });

  return errorMessages.join(" ");
}

export function getInvalidResponseZodErrorString({
  response,
  errors,
}: {
  response: AxiosResponse;
  errors: z.ZodIssue[];
}) {
  return `ERROR: Invalid response from '${response.config.url}':\n${getErrorMessageFromZodErrors({ errors })}`;
}

export function getSingularOrPluralFromArray({
  singular,
  plural,
  array,
  withCount = false,
  visibleAndMore,
}: {
  singular: string;
  plural?: string;
  array: unknown[];
} & (
  | {
      withCount?: boolean;
      visibleAndMore?: never;
    }
  | {
      withCount?: never;
      visibleAndMore?: number;
    }
)) {
  const innerPlural = plural ?? `${singular}s`;
  const singularOrPlural = array.length === 1 ? singular : innerPlural;
  const withCountString = `${array.length} ${singularOrPlural}`;
  const visibleAndMoreString =
    typeof visibleAndMore === "number" &&
    visibleAndMore > 0 &&
    visibleAndMore < array.length
      ? `${array.slice(0, visibleAndMore).join(", ")} and ${array.length - visibleAndMore} more ${array.length - visibleAndMore === 1 ? singular : innerPlural}`
      : withCountString;

  return withCount
    ? withCountString
    : typeof visibleAndMore === "number"
      ? visibleAndMoreString
      : singularOrPlural;
}

export function setAppCookie({
  cookieName,
  cookieValue,
}: {
  cookieName: string | undefined;
  cookieValue: unknown;
}) {
  const APP_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
  if (cookieName) {
    document.cookie = `${cookieName}=${cookieValue}; path=/; max-age=${APP_COOKIE_MAX_AGE}`;
  }
}

export function isInternalURL(url: string | undefined) {
  try {
    return url ? new URL(url).origin === location.origin : false;
  } catch {
    return false;
  }
}

export function isObject(value: unknown) {
  return typeof value === "object" && !Array.isArray(value) && value !== null;
}

export function handleAxiosError(error: AxiosError) {
  if (error.response) {
    const errorData = isObject(error.response.data)
      ? {
          ...(error.response.data as object),
          status: error.response.status,
        }
      : error.response.data;

    const serverErrorMessage =
      isObject(error.response.data) &&
      "message" in (error.response.data as object) &&
      (error.response.data as { message: string }).message.length
        ? (error.response.data as { message: string }).message
        : null;

    const isResponseFromInternalUrl = isInternalURL(error.request.responseURL);

    consoleError(
      `ERROR: ${isResponseFromInternalUrl && (error.status ?? 500) < 500 ? "invalid axios request to" : "axios error at"} '${error.response.config.url}', status ${error.status}:\n${!serverErrorMessage && !errorData ? (isResponseFromInternalUrl ? "Invalid response from server. Make sure to return a `NextResponse` from all branches of the route handler." : "Invalid response from server.") : serverErrorMessage ? `${serverErrorMessage}` : JSON.stringify(errorData, null, 2)}`
    );
  } else if (error.request) {
    consoleError(
      `ERROR: axios request error at '${error.request.responseURL}', status ${error.status}.\nRequest was made but no response was received.`
    );
  } else {
    consoleError(
      `ERROR: axios base error, status ${error.status}.\nError on setting up the request.\n${error}`
    );
  }

  return null;
}

export function consoleLog(
  itemToPrint: unknown | unknown[],
  options?: { shouldAlwaysPrint: boolean }
) {
  if (options?.shouldAlwaysPrint || process.env.NODE_ENV === "development") {
    if (Array.isArray(itemToPrint)) {
      console.log(...itemToPrint);
    } else {
      console.log(itemToPrint);
    }
  }
}

export function consoleWarn(
  itemToPrint: unknown | unknown[],
  options?: { shouldAlwaysPrint: boolean }
) {
  if (options?.shouldAlwaysPrint || process.env.NODE_ENV === "development") {
    if (Array.isArray(itemToPrint)) {
      console.warn(...itemToPrint);
    } else {
      console.warn(itemToPrint);
    }
  }
}

export function consoleError(
  itemToPrint: unknown | unknown[],
  options?: { shouldAlwaysPrint: boolean }
) {
  if (options?.shouldAlwaysPrint || process.env.NODE_ENV === "development") {
    if (Array.isArray(itemToPrint)) {
      console.error(...itemToPrint);
    } else {
      console.error(itemToPrint);
    }
  }
}

/* returns string without frontslash (e.g. "/url" -> "url") */
export const getStringWithoutFrontslash = (value: string) => {
  return value.startsWith("/") ? value.slice(1) : value;
};

// https://stackoverflow.com/a/32589289 : get string with each first letter capitalized
export const getTitleCase = (
  str: string,
  {
    delimiter,
    shouldJoinWithDelimiter,
  }: { delimiter: string; shouldJoinWithDelimiter?: boolean } = {
    delimiter: " ",
    shouldJoinWithDelimiter: false,
  }
) => {
  return str
    .toLowerCase()
    .split(delimiter)
    .map((word) => word.charAt(0).toUpperCase() + word.substring(1))
    .join(shouldJoinWithDelimiter ? delimiter : " ");
};
