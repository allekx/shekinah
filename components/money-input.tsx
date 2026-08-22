"use client";

import { parseMoneyFieldInput, reaisToMoneyDisplay } from "@/lib/money";

interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> {
  value: number | null;
  onValueChange: (value: number | null) => void;
}

/** Campo monetário estilo app bancário — dígitos entram da direita (centavos). */
export default function MoneyInput({
  value,
  onValueChange,
  className = "",
  placeholder = "0,00",
  onFocus,
  ...props
}: MoneyInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={reaisToMoneyDisplay(value)}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => onValueChange(parseMoneyFieldInput(e.target.value))}
      className={className}
    />
  );
}
