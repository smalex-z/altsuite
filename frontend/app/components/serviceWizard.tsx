'use client';

import React, { useState } from 'react';
import WizardInputField from './wizardInputField';

export type WizardFieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'url' | 'email' | 'number';
  placeholder?: string;
  description?: string;
  required?: boolean;
  validate?: (value: string) => string | undefined; // Returns error message if invalid
};

export type ServiceWizardProps = {
  fields: WizardFieldConfig[];
  onComplete: (data: Record<string, string>) => void;
  serviceName?: string;
  initialData?: Record<string, string>;
};

const ServiceWizard: React.FC<ServiceWizardProps> = ({
  fields,
  onComplete,
  serviceName = 'Service',
  initialData = {},
}) => {
  // Initialize formData with all field keys as empty strings, then override with initialData
  const initializeFormData = () => {
    const emptyFields: Record<string, string> = {};
    fields.forEach(field => {
      emptyFields[field.key] = '';
    });
    return { ...emptyFields, ...initialData };
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>(initializeFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentField = fields[currentStep];
  const progress = ((currentStep + 1) / fields.length) * 100;
  const isLastStep = currentStep === fields.length - 1;

  // Helper function to ensure all fields are present with at least empty strings
  const ensureAllFieldsPresent = (data: Record<string, string>): Record<string, string> => {
    const completeData: Record<string, string> = {};
    fields.forEach(field => {
      completeData[field.key] = data[field.key] || '';
    });
    return completeData;
  };

  const validateField = (field: WizardFieldConfig, value: string): string | undefined => {
    // Check required
    if (field.required && !value.trim()) {
      return 'This field is required';
    }

    // Check custom validation
    if (field.validate) {
      return field.validate(value);
    }

    // Basic type validation
    if (value.trim()) {
      switch (field.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Please enter a valid email address';
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            return 'Please enter a valid URL';
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            return 'Please enter a valid number';
          }
          break;
      }
    }

    return undefined;
  };

  const handleNext = () => {
    // Ensure current field has a value (even if empty string)
    if (!(currentField.key in formData)) {
      setFormData({ ...formData, [currentField.key]: '' });
    }

    if(fields[currentStep].required == false){
      if(isLastStep){
        // Ensure all fields are present in final data
        const completeData = ensureAllFieldsPresent(formData);
        onComplete(completeData);
        return
      } else {
        setCurrentStep(currentStep + 1);
      }
      return;
    }

    const error = validateField(currentField, formData[currentField.key] || '');

    if (error) {
      setErrors({ ...errors, [currentField.key]: error });
      return;
    }

    // Clear error for this field
    const newErrors = { ...errors };
    delete newErrors[currentField.key];
    setErrors(newErrors);

    if (isLastStep) {
      // Submit the form with all fields guaranteed to be present
      const completeData = ensureAllFieldsPresent(formData);
      onComplete(completeData);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFieldChange = (value: string) => {
    setFormData({ ...formData, [currentField.key]: value });
    // Clear error when user starts typing
    if (errors[currentField.key]) {
      const newErrors = { ...errors };
      delete newErrors[currentField.key];
      setErrors(newErrors);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 h-2">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {serviceName} Setup
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Step {currentStep + 1} of {fields.length}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {Math.round(progress)}% Complete
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-4xl">
          <WizardInputField
            label={currentField.label}
            value={formData[currentField.key] || ''}
            onChange={handleFieldChange}
            type={currentField.type}
            placeholder={currentField.placeholder}
            description={currentField.description}
            required={currentField.required}
            error={errors[currentField.key]}
            onEnter={handleNext}
            autoFocus={true}
          />
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="px-8 py-6 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`
              px-6 py-3 rounded-lg font-medium transition-all border
              ${currentStep === 0
                ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            ← Previous
          </button>

          <div className="flex space-x-2">
            {fields.map((_, index) => (
              <div
                key={index}
                className={`
                  w-2 h-2 rounded-full transition-all
                  ${index <= currentStep 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300'
                  }
                  ${index === currentStep ? 'w-8' : ''}
                `}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="
              px-6 py-3 rounded-lg font-medium
              bg-blue-600 text-white
              hover:bg-blue-700
              transition-all
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            "
          >
            {isLastStep ? 'Complete Setup →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceWizard;