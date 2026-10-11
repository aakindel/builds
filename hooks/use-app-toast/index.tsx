import { v4 as uuidv4 } from "uuid";
import { getNewLineStringWithBreakElements } from "@/utils";
import { toast } from "@/components/ui/toast";
import {
  getErrorToastMessage,
  type ErrorToastPropsType,
  type ErrorToastType,
} from "./error-toast";
import {
  getSuccessToastMessage,
  type SuccessToastPropsType,
  type SuccessToastType,
} from "./success-toast";

export function useAppToast() {
  function successToast({ ...props }: SuccessToastPropsType) {
    const toastId = props?.toastId ?? uuidv4();
    const { message, description } = getSuccessToastMessage({ ...props });

    return toast.add({
      id: toastId,
      type: "success",
      title: message,
      description,
    });
  }

  function errorToast({ ...props }: ErrorToastPropsType) {
    const toastId = props?.toastId ?? uuidv4();
    const { message, description } = getErrorToastMessage({ ...props });

    return toast.add({
      id: toastId,
      type: "error",
      title: message,
      description,
    });
  }

  function loadingToast({ ...props }: { toastId?: string; message?: string }) {
    const toastId = props?.toastId ?? uuidv4();
    const { message } = props;

    return toast.add({
      id: toastId,
      type: "loading",
      title: message ?? "Loading...",
      timeout: 0,
    });
  }

  return {
    successToast,
    errorToast,
    loadingToast,
  };
}

export const SuccessToastNode = ({ ...props }: SuccessToastPropsType) => {
  const { message, description } = getSuccessToastMessage({ ...props });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="text-sm leading-5 font-medium">
        {getNewLineStringWithBreakElements(message)}
      </div>
      {description ? (
        <div className="text-muted-foreground text-sm">
          {getNewLineStringWithBreakElements(description)}
        </div>
      ) : null}
    </div>
  );
};

export const ErrorToastNode = ({ ...props }: ErrorToastPropsType) => {
  const { message, description } = getErrorToastMessage({ ...props });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="text-sm leading-5 font-medium">
        {getNewLineStringWithBreakElements(message)}
      </div>
      {description ? (
        <div className="text-muted-foreground text-sm">
          {getNewLineStringWithBreakElements(description)}
        </div>
      ) : null}
    </div>
  );
};

export {
  type ErrorToastType,
  type ErrorToastPropsType,
  type SuccessToastType,
  type SuccessToastPropsType,
};
