"use client";

import { AppFormInputField } from "@/components/app-components/app-form";
import {
  SIGNUP_FORM_KEY,
  signupFormLabels,
  type SignupFormKeyType,
  type SignupFormType,
  type SignupFormValues,
} from "./form";

export const FormEmailField = ({
  form,
  fieldName,
}: {
  form: SignupFormType;
  fieldName: SignupFormKeyType["email"];
}) => {
  return (
    <AppFormInputField<SignupFormValues, "email">
      form={form}
      fieldId={getFieldId({ fieldName })}
      fieldLabel={signupFormLabels.email}
      fieldName={fieldName}
      fieldPlaceholder="Enter your email..."
      fieldOrientation="vertical"
    />
  );
};

function getFieldId({ fieldName }: { fieldName: string }) {
  return `${SIGNUP_FORM_KEY}-${fieldName}`;
}
