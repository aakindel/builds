"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export const LOGIN_FORM_KEY = "combined-card";

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
    <Card variant="elevated" className="w-full max-w-90 gap-6 py-8">
      <CardHeader className="justify-items-center gap-6 px-6 text-center">
        <DefaultAppLogo />
        <div className="flex flex-col items-center gap-2">
          <CardTitle className="text-2xl leading-8 font-semibold tracking-tight">
            Log in to your account
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="px-6">
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

      {/* variant=plain drops the muted band and top border. Card zeros pb when
          a footer exists (`has-data-[slot=card-footer]:pb-0`). Put the bottom
          inset on the footer so it matches Card `py-8`. */}
      <CardFooter variant="plain" className="justify-center px-6 pt-0 pb-8">
        <p className="text-subdued text-sm">
          Don&apos;t have an account?{" "}
          <AppLink href="#" variant="muted">
            Sign up
          </AppLink>
        </p>
      </CardFooter>
    </Card>
  );
};
