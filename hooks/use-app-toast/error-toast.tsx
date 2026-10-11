export type ErrorToastType = (props: ErrorToastPropsType) => string;

export function getErrorToastMessage({ ...props }: ErrorToastPropsType) {
  const { type } = props;

  let errorToastMessage: { message: string; description?: string };
  let errorToastDescription =
    "description" in props ? props.description : undefined;

  if (type === "action-error") {
    const { action } = props;
    errorToastMessage = {
      message: `Failed to ${action}`,
    };
    errorToastDescription = `Sorry, something went wrong when trying to ${action}. Please check the dev console for more details.`;
  } else if (type === "custom-error-toast") {
    const { message } = props;
    errorToastMessage = { message: message };
  } else {
    errorToastMessage = { message: "ERROR: invalid get error toast message!" };
  }

  errorToastMessage = {
    ...errorToastMessage,
    description: errorToastDescription,
  };

  return errorToastMessage;
}

export type ErrorToastPropsType = { toastId?: string } & (
  | {
      type: "action-error";
      action: string;
    }
  | {
      type: "custom-error-toast";
      message: string;
      description?: string;
    }
);
