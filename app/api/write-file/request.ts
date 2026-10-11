import { type ExactlyType } from "@/types";
import {
  genericPostRequest,
  handleInvalidRequest,
} from "@/requests/request-utils";
import { type ApiResponseMessageType } from "@/app/api/api-types";
import {
  apiWriteFileRequestSchema,
  type ApiWriteFileRequestType,
} from "./validation";

export const apiWriteFilePostRequest = async <
  T = void,
  // https://stackoverflow.com/a/57548987 : require generic parameter
  U extends T = T & ExactlyType<ApiWriteFileRequestType, T>,
>({
  requestPayload,
  onSuccess,
  onError,
}: {
  requestPayload: U;
  onSuccess: ({ parsedData }: { parsedData: ApiResponseMessageType }) => void;
  onError?: ({ error }: { error: ApiResponseMessageType }) => void;
}) => {
  const requestKey = "apiWriteFile";
  const parsedRequestPayload =
    await apiWriteFileRequestSchema.safeParseAsync(requestPayload);

  if (parsedRequestPayload.success) {
    // if request is valid
    await genericPostRequest<typeof requestKey, ApiWriteFileRequestType>({
      requestKey,
      requestPayload: parsedRequestPayload.data,
      onSuccess,
      onError,
    });
  } else {
    // if request is invalid
    handleInvalidRequest({ parsedRequestPayload, onError });
  }
};
