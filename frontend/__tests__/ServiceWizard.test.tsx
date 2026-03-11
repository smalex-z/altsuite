import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ServiceWizard, { WizardFieldConfig } from '../app/components/serviceWizard';

// Mock the WizardInputField to keep tests focused on ServiceWizard behavior
jest.mock('../app/components/wizardInputField', () => ({
  __esModule: true,
  default: ({
    label, value, onChange, onEnter, error, placeholder,
  }) => {
    const inputId = label?.replace(/[^a-zA-Z0-9]/g, '-');
    return (
      <div>
        <label htmlFor={inputId}>
          {label}
          <input
            id={inputId}
            aria-label={label}
            value={value || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEnter();
            }}
          />
        </label>
        {error && <div role="alert">{error}</div>}
      </div>
    );
  },
}));

describe('ServiceWizard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders and walks through the wizard to completion', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();

    const fields: WizardFieldConfig[] = [
      {
        key: 'publicUrl',
        label: 'Jitsi Public URL',
        type: 'url',
        placeholder: 'https://meet.example.com',
        description: 'The full URL of your Jitsi Meet instance',
        required: true,
      },
      {
        key: 'email',
        label: 'Admin Email (SSL)',
        type: 'email',
        placeholder: 'admin@example.com',
        description: "Email address used for Let's Encrypt SSL certificate registration",
        required: true,
      },
    ];

    render(<ServiceWizard fields={fields} onComplete={onComplete} serviceName="TestService" />);

    // initial render
    expect(screen.getByText('TestService setup wizard')).toBeInTheDocument();
    const getStepEl = () => screen.getByText((content) => content.includes('Step') && content.includes('of'));
    expect(getStepEl()).toHaveTextContent(/1/);

    // Try to proceed without entering required field -> shows validation
    const nextBtn = screen.getByRole('button', { name: /Next/ });
    await user.click(nextBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent('This field is required');

    // Fill host and proceed
    const hostInput = screen.getByLabelText('Jitsi Public URL');
    await user.type(hostInput, 'https://example.com');
    await user.click(nextBtn);

    expect(getStepEl()).toHaveTextContent(/2/);

    // Go back
    const prevBtn = screen.getByRole('button', { name: /Previous/ });
    await user.click(prevBtn);
    expect(getStepEl()).toHaveTextContent(/1/);

    // Move forward to step 2 again and fill email with invalid email first
    await user.click(nextBtn); // step 2
    const completeBtn = screen.getByRole('button', { name: /Complete Setup →/ });
    const emailInput = screen.getByLabelText('Admin Email (SSL)');
    await user.type(emailInput, 'not-an-email');
    await user.click(completeBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid email address');

    // Correct email and proceed to last step
    await user.clear(emailInput);
    await user.type(emailInput, 'admin@example.com');
    await user.click(completeBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      publicUrl: 'https://example.com',
      email: 'admin@example.com',
    });
  });

  it('supports initialData and preserves values', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    const fields = [{ key: 'username', label: 'Username', required: true }];

    render(<ServiceWizard fields={fields} onComplete={onComplete} initialData={{ username: 'alice' }} />);

    expect(screen.getByLabelText('Username')).toHaveValue('alice');
    const completeBtn2 = screen.getByRole('button', { name: /Complete Setup/ });
    await user.click(completeBtn2);
    expect(onComplete).toHaveBeenCalledWith({ username: 'alice' });
  });
});
