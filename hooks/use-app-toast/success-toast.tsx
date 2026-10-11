import { getSingularOrPluralFromArray } from "@/utils";

export type SuccessToastType = (props: SuccessToastPropsType) => string;

export function getSuccessToastMessage({ ...props }: SuccessToastPropsType) {
  const { type } = props;

  let successToastMessage: { message: string; description?: string };
  const successToastDescription =
    "description" in props ? props.description : undefined;

  if (type === "save-form-updates") {
    const { updateArray } = props;

    successToastMessage = {
      message: `Successfully saved ${getSingularOrPluralFromArray({
        singular: "update",
        array: updateArray,
      })}`,
    };
  } else if (type === "custom-success-toast") {
    const { message } = props;
    successToastMessage = { message: message };
  } else {
    successToastMessage = {
      message: "ERROR: invalid get success toast message!",
    };
  }

  successToastMessage = {
    ...successToastMessage,
    description: successToastDescription,
  };

  return successToastMessage;
}

export type SuccessToastPropsType = { toastId?: string } & (
  | {
      type: "save-form-updates";
      updateArray: unknown[];
      description: string;
    }
  | {
      type: "custom-success-toast";
      message: string;
      description?: string;
    }
);
