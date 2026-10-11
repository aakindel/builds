import * as z from "zod";
import { getZodEnumFromObjectKeys } from "@/utils";
import { NEXT_RESPONSE_MESSAGE_TYPES, STATUS_CODES } from "./api-constants";

export type NextResponseMessageSuccesssType = {
  type: (typeof NEXT_RESPONSE_MESSAGE_TYPES)["success-message"];
  message: string;
  status: (typeof STATUS_CODES)["200_OK"];
};

export type NextResponseMessageSuccessDataType = {
  type: (typeof NEXT_RESPONSE_MESSAGE_TYPES)["success-data"];
  data: unknown;
  status: (typeof STATUS_CODES)["200_OK"];
};

export type NextResponseMessageBadRequestType = {
  type: (typeof NEXT_RESPONSE_MESSAGE_TYPES)["bad-request-message"];
  message: string;
  status: (typeof STATUS_CODES)["400_BAD_REQUEST"];
};

export type NextResponseMessageInvalidCredentialsType = {
  type: (typeof NEXT_RESPONSE_MESSAGE_TYPES)["invalid-credentials-message"];
  message: string;
  status: (typeof STATUS_CODES)["401_UNAUTHORIZED"];
};

export type NextResponseMessageNotFoundType = {
  type: (typeof NEXT_RESPONSE_MESSAGE_TYPES)["not-found-message"];
  message: string;
  status: (typeof STATUS_CODES)["404_NOT_FOUND"];
};

export type NextResponseMessageInternalServerErrorType = {
  type: (typeof NEXT_RESPONSE_MESSAGE_TYPES)["internal-server-error-message"];
  message: string;
  status: (typeof STATUS_CODES)["500_INTERNAL_SERVER_ERROR"];
};

export type NextResponseMessageType =
  | NextResponseMessageSuccesssType
  | NextResponseMessageBadRequestType
  | NextResponseMessageInvalidCredentialsType
  | NextResponseMessageNotFoundType
  | NextResponseMessageInternalServerErrorType
  | NextResponseMessageSuccessDataType;

/* ============================================================================
   API RESPONSE MESSAGE TYPE
   ============================================================================ */

const { "success-data": successData, ...rest } = NEXT_RESPONSE_MESSAGE_TYPES;

export const apiResponseMessageSchema = z
  .strictObject({
    type: getZodEnumFromObjectKeys(rest),
    message: z.string(),
  })
  .or(
    z.strictObject({
      type: z.literal(successData),
      data: z.unknown(),
    })
  );

export type ApiResponseMessageType = z.infer<typeof apiResponseMessageSchema>;
