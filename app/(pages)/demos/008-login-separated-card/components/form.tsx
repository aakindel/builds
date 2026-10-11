"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { AppLink } from "@/components/app-components";
import { DefaultAppLogo } from "@/components/icons";
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

export const LOGIN_FORM_KEY = "separated-card";

const defaultFormValues: LoginFormValues = {
  email: "",
  password: "",
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
    <div className="flex w-full max-w-90 flex-col items-center gap-8">
      <div className="flex w-full flex-col items-center gap-6">
        <DefaultAppLogo />
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-2xl leading-8 font-semibold tracking-tight">
            Log in to your account
          </div>
        </div>
      </div>

      <Card variant="elevated" className="w-full gap-6 p-0">
        <CardContent className="px-6 py-8">
          <form
            className="flex w-full flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup className={cn("gap-6", "mb-8")}>
              <FormEmailField form={form} fieldName="email" />
              <FormPasswordField form={form} fieldName="password" />
            </FieldGroup>

            <Button type="submit" className="w-full" shouldPreventActiveScale>
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-subdued text-sm">
        Don&apos;t have an account?{" "}
        <AppLink href="#" variant="muted">
          Sign up
        </AppLink>
      </p>
    </div>
  );
};
