"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { AppLink } from "@/components/app-components";
import { DefaultAppLogo, Icons } from "@/components/icons";
import { FormEmailField } from "./form-fields";

const loginFormSchema = z.object({
  email: z.string(),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

type LoginFormKeysType = keyof LoginFormValues;

export type LoginFormKeyType = {
  [key in LoginFormKeysType]: key;
};

export type LoginFormType = UseFormReturn<
  LoginFormValues,
  unknown,
  LoginFormValues
>;

export const loginFormLabels: {
  [key in LoginFormKeysType]: string;
} = {
  email: "Email",
};

export const LOGIN_FORM_KEY = "social-buttons-row-below-divider";

const defaultFormValues: LoginFormValues = {
  email: "",
};

const SOCIAL_PROVIDERS = [
  { name: "Google", icon: Icons.google },
  { name: "Apple", icon: Icons.apple },
] as const;

export const LoginForm = () => {
  const form = useForm<LoginFormValues, unknown, LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: defaultFormValues,
  });

  const onSubmit = (values: LoginFormValues) => {
    void values;
  };

  return (
    <div className="flex w-full max-w-90 flex-col items-center">
      <div className={cn("flex w-full flex-col items-center", "gap-6", "mb-8")}>
        <DefaultAppLogo />
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-2xl leading-8 font-semibold tracking-tight">
            Log in to your account
          </div>
          <p className="text-subdued text-sm">
            Don&apos;t have an account?{" "}
            <AppLink href="#" variant="muted">
              Sign up
            </AppLink>
          </p>
        </div>
      </div>

      <form
        className="flex w-full flex-col"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup className="gap-4">
          <FormEmailField form={form} fieldName="email" />
          <Button type="submit" className="w-full" shouldPreventActiveScale>
            Log in
          </Button>
        </FieldGroup>
      </form>

      <FieldSeparator className={cn("w-full", "my-6")}>or</FieldSeparator>

      <div className={cn("flex w-full flex-wrap gap-2", "mb-8")}>
        {SOCIAL_PROVIDERS.map((provider) => {
          const Icon = provider.icon;

          return (
            <Button
              key={provider.name}
              type="button"
              variant="outline"
              className="flex-1"
              shouldPreventActiveScale
              prefix={<Icon />}
            >
              Log in with {provider.name}
            </Button>
          );
        })}
      </div>

      <p
        className={cn(
          "text-subdued text-center text-xs text-balance",
          "[&>a]:underline [&>a]:underline-offset-4"
        )}
      >
        By logging in, you acknowledge that you agree to our{" "}
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
  );
};
