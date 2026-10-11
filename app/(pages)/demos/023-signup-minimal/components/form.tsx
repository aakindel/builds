"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormEmailField } from "./form-fields";

const signupFormSchema = z.object({
  email: z.string(),
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
  email: "Email",
};

export const SIGNUP_FORM_KEY = "minimal-signup";

const defaultFormValues: SignupFormValues = {
  email: "",
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
        Continue with email
      </Button>
    </form>
  );
};
