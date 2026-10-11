import * as z from "zod";
import { consoleError, getErrorMessageFromZodErrors } from "@/utils";
import { type ApiResponseMessageType } from "@/app/api/api-types";

export const handleInvalidRequest = ({
  parsedRequestPayload,
  onError,
}: {
  parsedRequestPayload: z.ZodSafeParseError<unknown>;
  onError?: ({ error }: { error: ApiResponseMessageType }) => void;
}) => {
  const invalidRequestZodErrorString = getErrorMessageFromZodErrors({
    errors: parsedRequestPayload.error.issues,
  });

  const invalidRequestMessage: ApiResponseMessageType = {
    type: "bad-request-message",
    message: invalidRequestZodErrorString,
  };

  if (onError) {
    onError({ error: invalidRequestMessage });
  }
  consoleError(invalidRequestZodErrorString);
};
