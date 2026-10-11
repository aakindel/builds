"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { AppLink } from "@/components/app-components";
import { DefaultAppLogo, Icons } from "@/components/icons";
import {
  FormEmailField,
  FormFirstNameField,
  FormLastNameField,
  FormPasswordField,
} from "./form-fields";

const signupFormSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
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
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  password: "Password",
};

export const SIGNUP_FORM_KEY = "social-icon-buttons-row-below-divider-signup";

const defaultFormValues: SignupFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

const SOCIAL_PROVIDERS = [
  { name: "Google", icon: Icons.google },
  { name: "Apple", icon: Icons.apple },
  { name: "Meta", icon: Icons.meta },
] as const;

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
        className="flex w-full flex-col"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup className={cn("gap-6", "mb-8")}>
          <div className="grid grid-cols-2 gap-4">
            <FormFirstNameField form={form} fieldName="firstName" />
            <FormLastNameField form={form} fieldName="lastName" />
          </div>
          <FormEmailField form={form} fieldName="email" />
          <FormPasswordField form={form} fieldName="password" />
        </FieldGroup>

        <Button type="submit" className="w-full" shouldPreventActiveScale>
          Get started
        </Button>
      </form>

      <FieldSeparator className={cn("w-full", "my-6")}>
        or continue with
      </FieldSeparator>

      <div
        className={cn("flex w-full flex-wrap gap-2 min-[390px]:gap-4", "mb-8")}
      >
        {SOCIAL_PROVIDERS.map((provider) => {
          const Icon = provider.icon;

          return (
            <Button
              key={provider.name}
              type="button"
              variant="outline"
              className="flex-1"
              shouldPreventActiveScale
            >
              <Icon />
              <span className="sr-only">Sign up with {provider.name}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-6">
        <p className="text-subdued text-sm">
          Already have an account?{" "}
          <AppLink href="#" variant="muted">
            Log in
          </AppLink>
        </p>
        <p
          className={cn(
            "text-subdued text-center text-xs text-balance",
            "[&>a]:underline [&>a]:underline-offset-4"
          )}
        >
          By signing up, you acknowledge that you agree to our{" "}
          <AppLink href="#" variant="caption" size="xs">
            Terms of Service
          </AppLink>{" "}
          and{" "}
          <AppLink href="#" variant="caption" size="xs">
            Privacy Policy
          </AppLink>
          .
        </p>
      </div>
    </div>
  );
};
