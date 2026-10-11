"use client";

import { AppFormInputField } from "@/components/app-components/app-form";
import {
  LOGIN_FORM_KEY,
  loginFormLabels,
  type LoginFormKeyType,
  type LoginFormType,
  type LoginFormValues,
} from "./form";

export const FormEmailField = ({
  form,
  fieldName,
}: {
  form: LoginFormType;
  fieldName: LoginFormKeyType["email"];
}) => {
  return (
    <AppFormInputField<LoginFormValues, "email">
      form={form}
      fieldId={getFieldId({ fieldName })}
      fieldLabel={loginFormLabels.email}
      fieldName={fieldName}
      fieldPlaceholder="Enter your email..."
      fieldOrientation="vertical"
    />
  );
};

function getFieldId({ fieldName }: { fieldName: string }) {
  return `${LOGIN_FORM_KEY}-${fieldName}`;
}
