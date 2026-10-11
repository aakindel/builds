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

export const SIGNUP_FORM_KEY = "combined-card-signup";

const defaultFormValues: SignupFormValues = {
  name: "",
  email: "",
  password: "",
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
    <Card variant="elevated" className="w-full max-w-90 gap-6 py-8">
      <CardHeader className="justify-items-center gap-6 px-6 text-center">
        <DefaultAppLogo />
        <div className="flex flex-col items-center gap-2">
          <CardTitle className="text-2xl leading-8 font-semibold tracking-tight">
            Create your account
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="px-6">
        <form
          className="flex w-full flex-col"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FieldGroup className={cn("gap-6", "mb-8")}>
            <FormNameField form={form} fieldName="name" />
            <FormEmailField form={form} fieldName="email" />
            <FormPasswordField form={form} fieldName="password" />
          </FieldGroup>

          <Button type="submit" className="w-full" shouldPreventActiveScale>
            Get started
          </Button>
        </form>
      </CardContent>

      {/* variant=plain drops the muted band and top border. Card zeros pb when
          a footer exists (`has-data-[slot=card-footer]:pb-0`). Put the bottom
          inset on the footer so it matches Card `py-8`. */}
      <CardFooter variant="plain" className="justify-center px-6 pt-0 pb-8">
        <p className="text-subdued text-sm">
          Already have an account?{" "}
          <AppLink href="#" variant="muted">
            Log in
          </AppLink>
        </p>
      </CardFooter>
    </Card>
  );
};
