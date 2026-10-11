"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { AppLink } from "@/components/app-components";
import { DefaultAppLogo, Icons } from "@/components/icons";
import { FormEmailField, FormPasswordField } from "./form-fields";

const loginFormSchema = z.object({
  email: z.string(),
  password: z.string(),
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
  password: "Password",
};

export const LOGIN_FORM_KEY = "split-card";

const defaultFormValues: LoginFormValues = {
  email: "",
  password: "",
};

const SOCIAL_PROVIDERS = [
  { name: "Apple", icon: Icons.apple },
  { name: "Google", icon: Icons.google },
  { name: "Meta", icon: Icons.meta },
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
    <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-4xl">
      <Card variant="elevated" className="p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="flex flex-col p-6 md:p-8"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className={cn("flex flex-col items-center", "gap-6", "mb-8")}>
              <DefaultAppLogo />
              <div className="flex flex-col items-center gap-2 text-center">
                <CardTitle className="text-2xl leading-8 font-semibold tracking-tight">
                  Log in to your account
                </CardTitle>
              </div>
            </div>

            <FieldGroup className={cn("gap-6", "mb-8")}>
              <FormEmailField form={form} fieldName="email" />
              <FormPasswordField form={form} fieldName="password" />
            </FieldGroup>

            <Button type="submit" className="w-full" shouldPreventActiveScale>
              Log in
            </Button>

            <FieldSeparator className={cn("w-full", "my-6")}>
              or continue with
            </FieldSeparator>

            <div className={cn("grid grid-cols-3 gap-4", "mb-8")}>
              {SOCIAL_PROVIDERS.map((provider) => {
                const Icon = provider.icon;

                return (
                  <Button
                    key={provider.name}
                    type="button"
                    variant="outline"
                    className="w-full"
                    shouldPreventActiveScale
                  >
                    <Icon />
                    <span className="sr-only">
                      Continue with {provider.name}
                    </span>
                  </Button>
                );
              })}
            </div>

            <p className="text-subdued text-center text-sm">
              Don&apos;t have an account?{" "}
              <AppLink href="#" variant="muted">
                Sign up
              </AppLink>
            </p>
          </form>

          <div className="bg-muted relative hidden md:block">
            <picture>
              <img
                src="/image-placeholder.svg"
                alt=""
                className="absolute inset-0 size-full object-cover dark:brightness-[0.2] dark:grayscale"
              />
            </picture>
          </div>
        </CardContent>
      </Card>

      <p
        className={cn(
          "text-subdued px-6 text-center text-xs text-balance",
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
