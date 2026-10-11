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
import {
  FormEmailField,
  FormNameField,
  FormPasswordField,
} from "./form-fields";

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

export const SIGNUP_FORM_KEY = "split-card-signup";

const defaultFormValues: SignupFormValues = {
  name: "",
  email: "",
  password: "",
};

const SOCIAL_PROVIDERS = [
  { name: "Apple", icon: Icons.apple },
  { name: "Google", icon: Icons.google },
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
                  Create your account
                </CardTitle>
              </div>
            </div>

            <FieldGroup className={cn("gap-6", "mb-8")}>
              <FormNameField form={form} fieldName="name" />
              <FormEmailField form={form} fieldName="email" />
              <FormPasswordField form={form} fieldName="password" />
            </FieldGroup>

            <Button type="submit" className="w-full" shouldPreventActiveScale>
              Get started
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
                      Sign up with {provider.name}
                    </span>
                  </Button>
                );
              })}
            </div>

            <p className="text-subdued text-center text-sm">
              Already have an account?{" "}
              <AppLink href="#" variant="muted">
                Log in
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
  );
};
