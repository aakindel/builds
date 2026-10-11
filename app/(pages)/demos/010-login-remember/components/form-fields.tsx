"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { InputGroupButton } from "@/components/ui/input-group";
import {
  AppFormCheckboxField,
  AppFormInputField,
  AppFormInputGroupField,
} from "@/components/app-components/app-form";
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

export const FormPasswordField = ({
  form,
  fieldName,
}: {
  form: LoginFormType;
  fieldName: LoginFormKeyType["password"];
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const passwordValue = form.watch(fieldName);
  const hasPasswordValue = passwordValue !== "";

  return (
    <AppFormInputGroupField<LoginFormValues, "password">
      form={form}
      fieldId={getFieldId({ fieldName })}
      fieldLabel={loginFormLabels.password}
      fieldName={fieldName}
      fieldPlaceholder="Enter your password..."
      fieldOrientation="vertical"
      fieldInputType={showPassword ? "text" : "password"}
      fieldAutoComplete="current-password"
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

export const FormRememberField = ({
  form,
  fieldName,
}: {
  form: LoginFormType;
  fieldName: LoginFormKeyType["remember"];
}) => {
  return (
    <AppFormCheckboxField<LoginFormValues, "remember">
      form={form}
      fieldId={getFieldId({ fieldName })}
      fieldLabel={loginFormLabels.remember}
      fieldName={fieldName}
      fieldOrientation="horizontal"
      fieldClassName="w-auto"
    />
  );
};

function getFieldId({ fieldName }: { fieldName: string }) {
  return `${LOGIN_FORM_KEY}-${fieldName}`;
}
