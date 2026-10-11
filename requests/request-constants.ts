import { type RequestKeyType } from "./request-utils/generic-post-request";

export const REQUEST_KEY_URLS: { [key in RequestKeyType]: string } = {
  apiWriteFile: "/api/write-file",
};
