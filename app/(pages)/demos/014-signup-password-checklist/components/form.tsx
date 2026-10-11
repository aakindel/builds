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
  FormEmailField,
  FormNameField,
  FormPasswordField,
} from "./form-fields";
import { passesPasswordRules, PasswordChecklist } from "./password-checklist";

const signupFormSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
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
};

export const SIGNUP_FORM_KEY = "password-checklist";

const defaultFormValues: SignupFormValues = {
  name: "",
  email: "",
  password: "",
};

export const SignupForm = () => {
  const form = useForm<SignupFormValues, unknown, SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: defaultFormValues,
  });

  // The checklist is the error display: a failing rule turns its row red
  // after submit, so the password field shows no separate message.
  const onSubmit = (values: SignupFormValues) => {
    if (!passesPasswordRules(values)) {
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
          <div className="flex flex-col gap-3">
            <FormPasswordField form={form} fieldName="password" />
            <PasswordChecklist form={form} />
          </div>
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
