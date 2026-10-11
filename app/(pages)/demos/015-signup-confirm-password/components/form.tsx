"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { AppLink } from "@/components/app-components";
import { DefaultAppLogo } from "@/components/icons";
import {
  FormConfirmPasswordField,
  FormEmailField,
  FormNameField,
  FormPasswordField,
} from "./form-fields";

const signupFormSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;

type SignupFormKeysType = keyof SignupFormValues;

export type SignupFormKeyType = {
  [key in SignupFormKeysType]: key;
};

export type SignupFormType = UseFormReturn<
  SignupFormValues,
  unknown,
  SignupFormValues
>;

export const signupFormLabels: {
  [key in SignupFormKeysType]: string;
} = {
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
};

export const SIGNUP_FORM_KEY = "confirm-password";

const defaultFormValues: SignupFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export const SignupForm = () => {
  const form = useForm<SignupFormValues, unknown, SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: defaultFormValues,
  });

  // Checked on submit rather than in the schema: the input fields re-validate
  // on every keystroke, which would flag a mismatch while the user is still
  // typing the confirmation.
  const onSubmit = (values: SignupFormValues) => {
    if (values.password !== values.confirmPassword) {
      form.setError("confirmPassword", {
        type: "validate",
        message: "Passwords don't match",
      });
      return;
    }

    void values;
  };

  return (
    <div className="flex w-full max-w-90 flex-col items-center">
      <div className={cn("flex w-full flex-col items-center", "gap-6", "mb-8")}>
        <DefaultAppLogo />
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-2xl leading-8 font-semibold tracking-tight">
            Create your account
          </div>
        </div>
      </div>

      <form
        className={cn("flex w-full flex-col", "mb-8")}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup className={cn("gap-6", "mb-8")}>
          <FormNameField form={form} fieldName="name" />
          <FormEmailField form={form} fieldName="email" />
          <FormPasswordField form={form} fieldName="password" />
          <FormConfirmPasswordField form={form} fieldName="confirmPassword" />
        </FieldGroup>

        <Button type="submit" className="w-full" shouldPreventActiveScale>
          Get started
        </Button>
      </form>

      <p className="text-subdued text-sm">
        Already have an account?{" "}
        <AppLink href="#" variant="muted">
          Log in
        </AppLink>
      </p>
    </div>
  );
};
