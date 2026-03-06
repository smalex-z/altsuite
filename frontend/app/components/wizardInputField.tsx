'use client';

import React from 'react';

export type WizardInputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'url' | 'email' | 'number';
  placeholder?: string;
  description?: string;
  required?: boolean;
  error?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
};

const WizardInputField: React.FC<WizardInputFieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  description,
  required = false,
  error,
  onEnter,
  autoFocus = true,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) {
      onEnter();
    }
  };

  return (
    <div className="flex flex-col space-y-4 w-full max-w-2xl">
      <div className="space-y-2">
        <label className="text-3xl font-bold text-gray-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && (
          <p className="text-lg text-gray-600">
            {description}
          </p>
        )}
      </div>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`
          w-full px-6 py-4 text-xl
          bg-white
          border-2 rounded-lg
          transition-all duration-200
          text-gray-700
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error 
            ? 'border-red-500' 
            : 'border-gray-300 focus:border-blue-500'
          }
        `}
      />

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      <p className="text-sm text-gray-500">
        Press <kbd className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200">Enter ↵</kbd> to continue
      </p>
    </div>
  );
};

export default WizardInputField;