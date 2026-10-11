"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { InputGroupButton } from "@/components/ui/input-group";
import {
  AppFormInputField,
  AppFormInputGroupField,
} from "@/components/app-components/app-form";
import {
  SIGNUP_FORM_KEY,
  signupFormLabels,
  type SignupFormKeyType,
  type SignupFormType,
  type SignupFormValues,
} from "./form";

export const FormNameField = ({
  form,
  fieldName,
}: {
  form: SignupFormType;
  fieldName: SignupFormKeyType["name"];
}) => {
  return (
    <AppFormInputField<SignupFormValues, "name">
      form={form}
      fieldId={getFieldId({ fieldName })}
      fieldLabel={signupFormLabels.name}
      fieldName={fieldName}
      fieldPlaceholder="Enter your name..."
      fieldOrientation="vertical"
    />
  );
};

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

export const FormPasswordField = ({
  form,
  fieldName,
}: {
  form: SignupFormType;
  fieldName: SignupFormKeyType["password"];
}) => {
  return (
    <PasswordField
      form={form}
      fieldName={fieldName}
      fieldPlaceholder="Create a password..."
    />
  );
};

const PasswordField = ({
  form,
  fieldName,
  fieldPlaceholder,
}: {
  form: SignupFormType;
  fieldName: SignupFormKeyType["password"];
  fieldPlaceholder: string;
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const passwordValue = form.watch(fieldName);
  const hasPasswordValue = passwordValue !== "";

  return (
    <AppFormInputGroupField<SignupFormValues, typeof fieldName>
      form={form}
      fieldId={getFieldId({ fieldName })}
      fieldLabel={signupFormLabels[fieldName]}
      fieldName={fieldName}
      fieldPlaceholder={fieldPlaceholder}
      fieldOrientation="vertical"
      fieldInputType={showPassword ? "text" : "password"}
      fieldAutoComplete="new-password"
      fieldEndAddonActionSize="default"
      fieldEndAddon={
        hasPasswordValue ? (
          <InputGroupButton
            type="button"
            variant="highlight"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => {
              setShowPassword((value) => !value);
            }}
          >
            {showPassword ? (
              <EyeOffIcon className="size-(--ui-input-icon-size)" />
            ) : (
              <EyeIcon className="size-(--ui-input-icon-size)" />
            )}
          </InputGroupButton>
        ) : undefined
      }
      onValueChange={({ value }) => {
        if (value === "") {
          setShowPassword(false);
        }
      }}
    />
  );
};

function getFieldId({ fieldName }: { fieldName: string }) {
  return `${SIGNUP_FORM_KEY}-${fieldName}`;
}
