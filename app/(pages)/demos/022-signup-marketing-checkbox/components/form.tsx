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
  FormFirstNameField,
  FormLastNameField,
  FormMarketingField,
  FormPasswordField,
} from "./form-fields";

const signupFormSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  password: z.string(),
  marketing: z.boolean(),
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
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  password: "Password",
  marketing:
    "Receive marketing emails about new features, promotional offers, and general updates.",
};

export const SIGNUP_FORM_KEY = "marketing-checkbox";

const defaultFormValues: SignupFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  marketing: false,
};

export const SignupForm = () => {
  const form = useForm<SignupFormValues, unknown, SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: defaultFormValues,
  });

  const onSubmit = (values: SignupFormValues) => {
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
          <div className="grid grid-cols-2 gap-4">
            <FormFirstNameField form={form} fieldName="firstName" />
            <FormLastNameField form={form} fieldName="lastName" />
          </div>
          <FormEmailField form={form} fieldName="email" />
          <FormPasswordField form={form} fieldName="password" />
          <FormMarketingField form={form} fieldName="marketing" />
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
