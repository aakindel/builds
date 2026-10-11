import axios, { AxiosError } from "axios";
import { type ExactlyType } from "@/types";
import {
  consoleError,
  getInvalidResponseZodErrorString,
  handleAxiosError,
} from "@/utils";
import {
  apiResponseMessageSchema,
  type ApiResponseMessageType,
} from "@/app/api/api-types";
import { type ApiWriteFileRequestType } from "@/app/api/write-file/validation";
import { REQUEST_KEY_URLS } from "../request-constants";

type RequestPayloadByKeyType = {
  apiWriteFile: {
    requestPayload: ApiWriteFileRequestType;
  };
};

export type RequestKeyType = keyof RequestPayloadByKeyType;

// https://stackoverflow.com/a/65012605 : base param type on other param
export async function genericPostRequest<
  GenericRequestKeyType extends RequestKeyType,
  ExactRequestPayloadType extends ExactlyType<
    RequestPayloadByKeyType[GenericRequestKeyType]["requestPayload"],
    ExactRequestPayloadType
  >,
>({
  requestKey,
  requestPayload,
  onSuccess,
  onError,
}: {
  requestKey: RequestKeyType;
  requestPayload: ExactRequestPayloadType;
  onSuccess: ({ parsedData }: { parsedData: ApiResponseMessageType }) => void;
  onError?: ({ error }: { error: ApiResponseMessageType }) => void;
}) {
  await axios
    .post<ApiResponseMessageType>(REQUEST_KEY_URLS[requestKey], requestPayload)
    .then(async (response) => {
      // validate api response
      const parsedResponseData = await apiResponseMessageSchema.safeParseAsync(
        response.data
      );

      if (parsedResponseData.success) {
        // if api response is valid
        onSuccess({ parsedData: parsedResponseData.data });
      } else {
        // if api responds with invalid type (still 200 status)
        const invalidResponseZodErrorString = getInvalidResponseZodErrorString({
          response,
          errors: parsedResponseData.error.issues,
        });

        const invalidResponseFromApiMessage: ApiResponseMessageType = {
          type: "internal-server-error-message",
          message: invalidResponseZodErrorString,
        };

        if (onError) {
          onError({ error: invalidResponseFromApiMessage });
        }
        consoleError(invalidResponseZodErrorString);
      }

      return parsedResponseData;
    })
    .catch((error: AxiosError<ApiResponseMessageType>) => {
      // if api call fails (4xx or 5xx status)
      const defaultErrorMessage: ApiResponseMessageType = {
        type: "internal-server-error-message",
        message: "default internal server error",
      };

      if (onError) {
        onError({ error: error.response?.data ?? defaultErrorMessage });
      }
      handleAxiosError(error);
    });
}
