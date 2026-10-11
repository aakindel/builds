import React from "react";
import {
  Controller,
  FieldValues,
  Path,
  type UseFormReturn,
} from "react-hook-form";
import { type FieldOptionDescriptionType, type FieldOptionType } from "@/types";
import { getFieldOptionsServerValue } from "@/utils";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConditionalRender } from "../conditional-render";
import { Checkbox } from "../ui/checkbox";

type AppFormFieldOrientationType = React.ComponentProps<
  typeof Field
>["orientation"];

export const AppFormInputField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldPlaceholder,
  fieldOrientation = "gridResponsive",
  fieldRequired = false,
  fieldHideError = false,
  fieldInputClassName,
  fieldLabelClassName,
  fieldReadOnly = false,
  fieldAutoFocus = false,
  fieldSuffix,
  onBlur,
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldPlaceholder?: string;
  fieldOrientation?: AppFormFieldOrientationType;
  fieldRequired?: boolean;
  fieldHideError?: boolean;
  fieldInputClassName?: string;
  fieldLabelClassName?: string;
  fieldReadOnly?: boolean;
  fieldAutoFocus?: boolean;
  fieldSuffix?: React.ReactNode;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      rules={
        fieldRequired ? { required: `${fieldLabel} is required` } : undefined
      }
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={fieldId} className={fieldLabelClassName}>
                {fieldLabel}
              </FieldLabel>
              <ConditionalRender condition={!!fieldSuffix}>
                {fieldSuffix}
              </ConditionalRender>
            </div>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <Input
            {...field}
            id={fieldId}
            readOnly={fieldReadOnly}
            autoFocus={fieldAutoFocus}
            aria-invalid={fieldState.invalid}
            placeholder={fieldPlaceholder ?? "Input Text"}
            className={fieldInputClassName}
            onBlur={(event) => {
              field.onBlur();
              if (onBlur) {
                onBlur(event);
              }
            }}
            onChange={(event) => {
              if (fieldReadOnly) {
                return;
              }

              field.onChange(event.target.value);
              form.trigger(field.name);
              if (onValueChange) {
                onValueChange({
                  fieldName: field.name,
                  value: event.target.value,
                });
              }
            }}
          />
          <ConditionalRender condition={fieldState.invalid && !fieldHideError}>
            <FieldError errors={[fieldState.error]} />
          </ConditionalRender>
        </Field>
      )}
    />
  );
};

export const AppFormInputGroupField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldPlaceholder,
  fieldOrientation = "gridResponsive",
  fieldRequired = false,
  fieldHideError = false,
  fieldInputClassName,
  fieldInputGroupClassName,
  fieldLabelClassName,
  fieldReadOnly = false,
  fieldAutoFocus = false,
  fieldInputType = "text",
  fieldAutoComplete,
  fieldStartAddon,
  fieldEndAddon,
  fieldEndAddonClassName,
  fieldEndAddonActionSize,
  fieldSuffix,
  onBlur,
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldPlaceholder?: string;
  fieldOrientation?: AppFormFieldOrientationType;
  fieldRequired?: boolean;
  fieldHideError?: boolean;
  fieldInputClassName?: string;
  fieldInputGroupClassName?: string;
  fieldLabelClassName?: string;
  fieldReadOnly?: boolean;
  fieldAutoFocus?: boolean;
  fieldInputType?: React.HTMLInputTypeAttribute;
  fieldAutoComplete?: string;
  fieldStartAddon?: React.ReactNode;
  fieldEndAddon?: React.ReactNode;
  fieldEndAddonClassName?: string;
  fieldEndAddonActionSize?: "default" | "small";
  fieldSuffix?: React.ReactNode;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      rules={
        fieldRequired ? { required: `${fieldLabel} is required` } : undefined
      }
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={fieldId} className={fieldLabelClassName}>
                {fieldLabel}
              </FieldLabel>
              <ConditionalRender condition={!!fieldSuffix}>
                {fieldSuffix}
              </ConditionalRender>
            </div>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <InputGroup className={fieldInputGroupClassName}>
            {fieldStartAddon ? (
              <InputGroupAddon align="inline-start">
                {fieldStartAddon}
              </InputGroupAddon>
            ) : (
              <React.Fragment />
            )}
            <InputGroupInput
              {...field}
              id={fieldId}
              type={fieldInputType}
              {...(fieldAutoComplete
                ? { autoComplete: fieldAutoComplete }
                : {})}
              readOnly={fieldReadOnly}
              autoFocus={fieldAutoFocus}
              aria-invalid={fieldState.invalid}
              placeholder={fieldPlaceholder ?? "Input Text"}
              className={fieldInputClassName}
              onBlur={(event) => {
                field.onBlur();
                if (onBlur) {
                  onBlur(event);
                }
              }}
              onChange={(event) => {
                if (fieldReadOnly) {
                  return;
                }

                field.onChange(event.target.value);
                form.trigger(field.name);
                if (onValueChange) {
                  onValueChange({
                    fieldName: field.name,
                    value: event.target.value,
                  });
                }
              }}
            />
            {fieldEndAddon ? (
              <InputGroupAddon
                align="inline-end"
                actionSize={fieldEndAddonActionSize}
                className={fieldEndAddonClassName}
              >
                {fieldEndAddon}
              </InputGroupAddon>
            ) : (
              <React.Fragment />
            )}
          </InputGroup>
          <ConditionalRender condition={fieldState.invalid && !fieldHideError}>
            <FieldError errors={[fieldState.error]} />
          </ConditionalRender>
        </Field>
      )}
    />
  );
};

export const AppFormTextareaField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOrientation = "gridResponsive",
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOrientation?: AppFormFieldOrientationType;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <Textarea
            {...field}
            id={fieldId}
            aria-invalid={fieldState.invalid}
            placeholder="Textarea Text"
            className="min-h-30"
            onChange={(event) => {
              field.onChange(event.target.value);
              form.trigger(field.name);
              if (onValueChange) {
                onValueChange({
                  fieldName: field.name,
                  value: event.target.value,
                });
              }
            }}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};

export const AppFormChoiceCardField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOptions,
  fieldOrientation = "gridResponsive",
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOptions: FieldOptionDescriptionType[];
  fieldOrientation?: AppFormFieldOrientationType;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLegend variant="label" className="mb-0">
              {fieldLabel}
            </FieldLegend>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <RadioGroup
            name={field.name}
            value={field.value}
            onValueChange={(value) => {
              if (value == null) {
                return;
              }

              field.onChange(value);
              form.trigger(field.name);
              if (onValueChange) {
                onValueChange({
                  fieldName: field.name,
                  value: value,
                });
              }
            }}
            aria-invalid={fieldState.invalid}
          >
            {fieldOptions.map((fieldOption) => {
              const optionId = `${fieldId}-${fieldOption.id}`;
              return (
                <FieldLabel key={fieldOption.id} htmlFor={optionId}>
                  <Field
                    orientation="horizontal"
                    className="items-center *:[[role=radio]]:mt-0"
                  >
                    <FieldContent>
                      <FieldTitle>{fieldOption.title}</FieldTitle>
                      <FieldDescription>
                        {fieldOption.description}
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value={fieldOption.id} id={optionId} />
                  </Field>
                </FieldLabel>
              );
            })}
          </RadioGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};

export const AppFormRadioField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOptions,
  fieldOrientation = "gridResponsive",
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOptions: FieldOptionType[];
  fieldOrientation?: AppFormFieldOrientationType;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLegend variant="label" className="mb-0">
              {fieldLabel}
            </FieldLegend>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <RadioGroup
            name={field.name}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              form.trigger(field.name);
              if (onValueChange) {
                onValueChange({
                  fieldName: field.name,
                  value,
                });
              }
            }}
            aria-invalid={fieldState.invalid}
          >
            {fieldOptions.map((fieldOption) => {
              const optionId = `${fieldId}-${fieldOption.id}`;
              return (
                <Field key={fieldOption.id} orientation="horizontal">
                  <RadioGroupItem value={fieldOption.id} id={optionId} />
                  <FieldLabel htmlFor={optionId} className="font-normal">
                    {fieldOption.title}
                  </FieldLabel>
                </Field>
              );
            })}
          </RadioGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};

export const AppFormSelectField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOptions,
  fieldOrientation = "gridResponsive",
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOptions: FieldOptionType[];
  fieldOrientation?: AppFormFieldOrientationType;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <Select<string>
            name={field.name}
            value={field.value}
            items={[
              { label: "Select", value: null },
              ...fieldOptions.map((fieldOption) => ({
                label: fieldOption.title,
                value: fieldOption.id,
              })),
            ]}
            onValueChange={(value) => {
              if (value == null) {
                return;
              }

              field.onChange(value);
              form.trigger(field.name);
              if (onValueChange) {
                onValueChange({
                  fieldName: field.name,
                  value: value,
                });
              }
            }}
          >
            <SelectTrigger
              id={fieldId}
              aria-invalid={fieldState.invalid}
              className="w-full max-w-56"
              aria-controls={fieldId}
            >
              <SelectValue
                serverValue={getFieldOptionsServerValue({
                  fieldOptions,
                  fieldValue: field.value,
                })}
              />
            </SelectTrigger>
            <SelectContent>
              {fieldOptions.map((fieldOption) => (
                <SelectItem key={fieldOption.id} value={fieldOption.id}>
                  {fieldOption.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};

export const AppFormSwitchField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOrientation = "gridResponsive",
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOrientation?: AppFormFieldOrientationType;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: boolean;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <FieldGroup className="w-full">
            <Switch
              id={fieldId}
              name={field.name}
              checked={field.value}
              onCheckedChange={(value) => {
                field.onChange(value);
                form.trigger(field.name);
                if (onValueChange) {
                  onValueChange({
                    fieldName: field.name,
                    value: !!value,
                  });
                }
              }}
              aria-invalid={fieldState.invalid}
            />
          </FieldGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};

export const AppFormCheckboxField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOrientation = "horizontal",
  fieldClassName,
  fieldLabelClassName,
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOrientation?: AppFormFieldOrientationType;
  fieldClassName?: string;
  fieldLabelClassName?: string;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: boolean;
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field
          orientation={fieldOrientation}
          data-invalid={fieldState.invalid}
          className={fieldClassName}
        >
          <Field orientation="horizontal">
            <Checkbox
              id={fieldId}
              name={field.name}
              checked={field.value}
              onCheckedChange={(value) => {
                field.onChange(value);
                form.trigger(field.name);
                if (onValueChange) {
                  onValueChange({
                    fieldName: field.name,
                    value: !!value,
                  });
                }
              }}
              aria-invalid={fieldState.invalid}
            />
            <FieldLabel
              htmlFor={fieldId}
              className={fieldLabelClassName ?? "font-normal"}
            >
              {fieldLabel}
            </FieldLabel>
          </Field>
          {fieldDescription ? (
            <FieldDescription>{fieldDescription}</FieldDescription>
          ) : (
            <React.Fragment />
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};

export const AppFormCheckboxGroupField = <
  FormValues extends FieldValues,
  FieldKeyType extends Path<FormValues>,
>({
  form,
  fieldId,
  fieldLabel,
  fieldName,
  fieldDescription,
  fieldOptions,
  fieldOrientation = "gridResponsive",
  onValueChange,
}: {
  form: UseFormReturn<FormValues, unknown, FormValues>;
  fieldId: string;
  fieldLabel: string;
  fieldName: FieldKeyType;
  fieldDescription?: string;
  fieldOptions: FieldOptionDescriptionType[];
  fieldOrientation?: AppFormFieldOrientationType;
  onValueChange?: ({
    fieldName,
    value,
  }: {
    fieldName: FieldKeyType;
    value: string[];
  }) => void;
}) => {
  return (
    <Controller
      name={fieldName}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field orientation={fieldOrientation} data-invalid={fieldState.invalid}>
          <FieldContent>
            <FieldLegend variant="label" className="mb-0">
              {fieldLabel}
            </FieldLegend>
            {fieldDescription ? (
              <FieldDescription>{fieldDescription}</FieldDescription>
            ) : (
              <React.Fragment />
            )}
          </FieldContent>
          <FieldGroup data-slot="checkbox-group">
            {fieldOptions.map((fieldOption) => {
              const optionId = `${fieldId}-${fieldOption.id}`;
              return (
                <Field
                  key={fieldOption.id}
                  orientation="horizontal"
                  data-invalid={fieldState.invalid}
                >
                  <Field orientation="horizontal">
                    <Checkbox
                      id={optionId}
                      name={field.name}
                      aria-invalid={fieldState.invalid}
                      checked={field.value.includes(fieldOption.id)}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...field.value, fieldOption.id]
                          : field.value.filter(
                              (v: string) => v !== fieldOption.id
                            );
                        field.onChange(newValue);
                        form.trigger(field.name);
                        if (onValueChange) {
                          onValueChange({
                            fieldName: field.name,
                            value: newValue,
                          });
                        }
                        field.onBlur();
                      }}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={optionId}>
                        {fieldOption.title}
                      </FieldLabel>
                      <FieldDescription>
                        {fieldOption.description}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </Field>
              );
            })}
          </FieldGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};
