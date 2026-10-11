"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
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

export const LOGIN_FORM_KEY = "minimal";

const defaultFormValues: LoginFormValues = {
  email: "",
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
    <form
      className="flex w-full max-w-90 flex-col gap-3"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        <FormEmailField form={form} fieldName="email" />
      </FieldGroup>

      <Button
        type="submit"
        variant="outline"
        className="w-full"
        shouldPreventActiveScale
      >
        Send me a magic link
      </Button>
    </form>
  );
};
