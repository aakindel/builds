import { NextResponse } from "next/server";
import * as z from "zod";
import { consoleError, getErrorMessageFromZodErrors } from "@/utils";
import { type ApiResponseMessageType } from "@/app/api/api-types";
import { STATUS_CODES } from "./api-constants";
import { type NextResponseMessageType } from "./api-types";

export const getNextResponse = ({
  ...props
}: NextResponseMessageType): NextResponse<ApiResponseMessageType> => {
  const { type } = props;

  if (
    type === "success-message" ||
    type === "bad-request-message" ||
    type === "invalid-credentials-message" ||
    type === "not-found-message" ||
    type === "internal-server-error-message"
  ) {
    const { message } = props;
    const response: ApiResponseMessageType = { type, message };

    let statusCode;

    if (type === "success-message") {
      statusCode = STATUS_CODES["200_OK"];
    } else if (type === "bad-request-message") {
      statusCode = STATUS_CODES["400_BAD_REQUEST"];
    } else if (type === "invalid-credentials-message") {
      statusCode = STATUS_CODES["401_UNAUTHORIZED"];
    } else if (type === "not-found-message") {
      statusCode = STATUS_CODES["404_NOT_FOUND"];
    } else if (type === "internal-server-error-message") {
      statusCode = STATUS_CODES["500_INTERNAL_SERVER_ERROR"];
    }

    return NextResponse.json(response, { status: statusCode });
  } else if (type === "success-data") {
    const { data } = props;
    const response: ApiResponseMessageType = { type, data };

    return NextResponse.json(response, { status: STATUS_CODES["200_OK"] });
  }

  throw new Error(
    `"getNextResponse" has an undefined return value with the following arguments: ${props}`
  );
};

export const getBadRequestNextResponse = ({
  parsedRequestPayload,
}: {
  parsedRequestPayload: z.ZodSafeParseError<unknown>;
}) => {
  consoleError(parsedRequestPayload.error.issues);
  return getNextResponse({
    type: "bad-request-message",
    message: getErrorMessageFromZodErrors({
      errors: parsedRequestPayload.error.issues,
    }),
    status: 400,
  });
};

export const getInternalServerErrorNextResponse = ({
  error,
}: {
  error: unknown;
}) => {
  consoleError(error);
  return getNextResponse({
    type: "internal-server-error-message",
    message: `internal server error: ${error}`,
    status: 500,
  });
};
