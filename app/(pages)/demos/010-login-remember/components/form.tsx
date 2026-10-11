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
  FormPasswordField,
  FormRememberField,
} from "./form-fields";

const loginFormSchema = z.object({
  email: z.string(),
  password: z.string(),
  remember: z.boolean(),
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
  remember: "Remember for 30 days",
};

export const LOGIN_FORM_KEY = "remember";

const defaultFormValues: LoginFormValues = {
  email: "",
  password: "",
  remember: false,
};

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
        </div>
      </div>

      <form
        className={cn("flex w-full flex-col", "mb-8")}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup className="gap-6">
          <FormEmailField form={form} fieldName="email" />
          <FormPasswordField form={form} fieldName="password" />
        </FieldGroup>

        <div
          className={cn(
            "flex items-center justify-between gap-3",
            "mt-6",
            "mb-8"
          )}
        >
          <FormRememberField form={form} fieldName="remember" />
          <AppLink href="#">Forgot password</AppLink>
        </div>

        <Button type="submit" className="w-full" shouldPreventActiveScale>
          Log in
        </Button>
      </form>

      <p className="text-subdued text-sm">
        Don&apos;t have an account?{" "}
        <AppLink href="#" variant="muted">
          Sign up
        </AppLink>
      </p>
    </div>
  );
};
