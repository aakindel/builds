"use client";

import { CircleCheckIcon } from "lucide-react";
import { useFormState, useWatch } from "react-hook-form";
import { cn } from "@/utils";
import { type SignupFormType, type SignupFormValues } from "./form";

export const PASSWORD_RULES = [
  {
    id: "min-length",
    label: "Must be 8 characters minimum",
    test: ({ password }: Pick<SignupFormValues, "password" | "email">) => {
      return password.length >= 8;
    },
  },
  {
    id: "not-email",
    label: "Must not match email address",
    // null while the password is empty: the rule has nothing to check yet.
    test: ({
      password,
      email,
    }: Pick<SignupFormValues, "password" | "email">) => {
      if (password === "") {
        return null;
      }

      return password.trim().toLowerCase() !== email.trim().toLowerCase();
    },
  },
] as const;

export function passesPasswordRules(
  values: Pick<SignupFormValues, "password" | "email">
) {
  return PASSWORD_RULES.every((rule) => {
    return rule.test(values) === true;
  });
}

export const PasswordChecklist = ({ form }: { form: SignupFormType }) => {
  const [password, email] = useWatch({
    control: form.control,
    name: ["password", "email"],
  });
  const { isSubmitted } = useFormState({ control: form.control });

  return (
    <ul className="flex flex-col gap-1">
      {PASSWORD_RULES.map((rule) => {
        const result = rule.test({ password, email });
        const isPassed = result === true;
        const isFailed = result === false && isSubmitted;

        return (
          <li
            key={rule.id}
            className={cn(
              "text-subdued flex items-center gap-2 text-sm",
              isFailed && "text-destructive"
            )}
          >
            <CircleCheckIcon
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 transition-colors",
                isPassed && "text-green-700 dark:text-green-400"
              )}
            />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
};
