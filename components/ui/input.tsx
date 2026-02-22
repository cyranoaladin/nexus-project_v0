import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, icon, iconPosition = 'left', ...props }, ref) => {
    const inputId = React.useId();
    const helperId = React.useId();
    const errorId = React.useId();

    const hasError = !!error;
    const hasIcon = !!icon;

    const inputElement = (
      <div className="relative w-full">
        {hasIcon && iconPosition === 'left' && (
          <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            "flex h-10 md:h-12 w-full rounded-lg border bg-surface-elevated text-neutral-100 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
            hasError
              ? "border-blue-500 focus-visible:ring-blue-500 animate-shake"
              : "border-white/15",
            hasIcon && iconPosition === 'left' && "pl-10 md:pl-11",
            hasIcon && iconPosition === 'right' && "pr-10 md:pr-11",
            className
          )}
          ref={ref}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? errorId : helperText ? helperId : undefined
          }
          aria-required={props.required}
          {...props}
        />
        {hasIcon && iconPosition === 'right' && (
          <div className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
    );

    if (!label && !error && !helperText) {
      return inputElement;
    }

    return (
      <div className="w-full space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300">
            {label}
            {props.required && <span className="text-slate-500 ml-1" aria-label="required">*</span>}
          </label>
        )}
        {inputElement}
        {helperText && !hasError && (
          <p id={helperId} className="text-sm text-neutral-400">
            {helperText}
          </p>
        )}
        {hasError && (
          <p id={errorId} role="alert" className="text-sm text-slate-500">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
