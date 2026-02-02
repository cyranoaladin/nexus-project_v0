/**
 * Input Component Tests
 *
 * Tests for enhanced input component with validation and animations
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const EmailIcon = () => <svg data-testid="email-icon" />;
const SearchIcon = () => <svg data-testid="search-icon" />;

describe('Input', () => {
  describe('Rendering', () => {
    it('renders input without label, error, or helper text', () => {
      render(<Input placeholder="Enter text" />);

      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('renders input with label', () => {
      render(<Input label="Email" placeholder="Enter email" />);

      const label = screen.getByText('Email');
      const input = screen.getByPlaceholderText('Enter email');
      
      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
      expect(label).toHaveAttribute('for', input.id);
    });

    it('renders input with helper text', () => {
      render(<Input label="Password" helperText="Must be at least 8 characters" />);

      const helperText = screen.getByText('Must be at least 8 characters');
      expect(helperText).toBeInTheDocument();
      expect(helperText).toHaveClass('text-gray-600');
    });

    it('renders input with error message', () => {
      render(<Input label="Email" error="Email is required" />);

      const error = screen.getByText('Email is required');
      expect(error).toBeInTheDocument();
      expect(error).toHaveClass('text-red-500');
      expect(error).toHaveAttribute('role', 'alert');
    });

    it('does not show helper text when error is present', () => {
      render(
        <Input 
          label="Email" 
          helperText="Enter your email"
          error="Email is required" 
        />
      );

      expect(screen.queryByText('Enter your email')).not.toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('renders required indicator when required prop is true', () => {
      render(<Input label="Email" required />);

      const requiredIndicator = screen.getByText('*');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveClass('text-red-500');
      expect(requiredIndicator).toHaveAttribute('aria-label', 'required');
    });

    it('renders input with left icon', () => {
      render(<Input label="Email" icon={<EmailIcon />} iconPosition="left" />);

      const icon = screen.getByTestId('email-icon');
      expect(icon).toBeInTheDocument();
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10');
    });

    it('renders input with right icon', () => {
      render(<Input label="Search" icon={<SearchIcon />} iconPosition="right" />);

      const icon = screen.getByTestId('search-icon');
      expect(icon).toBeInTheDocument();
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10');
    });

    it('defaults to left icon position when not specified', () => {
      render(<Input icon={<EmailIcon />} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10');
    });

    it('applies custom className', () => {
      render(<Input className="custom-class" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
      expect(input).toHaveClass('rounded-lg');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Input ref={ref as any} />);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('associates label with input using unique id', () => {
      render(
        <>
          <Input label="First Name" />
          <Input label="Last Name" />
        </>
      );
      
      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      
      expect(firstNameInput.id).toBeTruthy();
      expect(lastNameInput.id).toBeTruthy();
      expect(firstNameInput.id).not.toBe(lastNameInput.id);
    });

    it('sets aria-invalid to true when error is present', () => {
      render(<Input error="Invalid input" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-invalid to false when no error', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('sets aria-required when required prop is true', () => {
      render(<Input required />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('does not set aria-required when not required', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-required');
    });

    it('associates error message with input via aria-describedby', () => {
      render(<Input label="Email" error="Email is required" />);

      const input = screen.getByRole('textbox');
      const error = screen.getByText('Email is required');
      
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(error.id).toBe(describedBy);
    });

    it('associates helper text with input via aria-describedby', () => {
      render(<Input label="Password" helperText="Must be 8+ characters" />);

      const input = screen.getByRole('textbox');
      const helperText = screen.getByText('Must be 8+ characters');
      
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(helperText.id).toBe(describedBy);
    });

    it('prioritizes error over helper text in aria-describedby', () => {
      render(
        <Input 
          label="Email" 
          error="Email is required"
          helperText="Enter your email" 
        />
      );

      const input = screen.getByRole('textbox');
      const error = screen.getByText('Email is required');
      
      const describedBy = input.getAttribute('aria-describedby');
      expect(error.id).toBe(describedBy);
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Input label="Name" />);

      const input = screen.getByRole('textbox');
      
      await user.tab();
      expect(input).toHaveFocus();
      
      await user.keyboard('John Doe');
      expect(input).toHaveValue('John Doe');
    });

    it('has proper focus-visible styles', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus-visible:outline-none');
      expect(input).toHaveClass('focus-visible:ring-2');
      expect(input).toHaveClass('focus-visible:ring-primary-500');
    });

    it('error message has role="alert" for screen readers', () => {
      render(<Input error="Invalid input" />);

      const error = screen.getByRole('alert');
      expect(error).toHaveTextContent('Invalid input');
    });
  });

  describe('Validation with react-hook-form and Zod', () => {
    const TestForm = () => {
      const schema = z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });

      const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        mode: 'onChange',
      });

      const onSubmit = jest.fn();

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Email"
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            label="Password"
            type="password"
            {...register('password')}
            error={errors.password?.message}
          />
          <button type="submit">Submit</button>
        </form>
      );
    };

    it('integrates with react-hook-form', async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('displays Zod validation errors', async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });

    it('validates minimum length with Zod', async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(passwordInput, 'short');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('clears error when input becomes valid', async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(emailInput, 'invalid');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });

      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');

      await waitFor(() => {
        expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument();
      });
    });
  });

  describe('Animations', () => {
    it('has focus border transition animation', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('transition-all');
      expect(input).toHaveClass('duration-200');
    });

    it('applies error shake animation when error is present', () => {
      render(<Input error="Error message" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('animate-shake');
    });

    it('does not apply shake animation when no error', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveClass('animate-shake');
    });

    it('applies error styling when error is present', () => {
      render(<Input error="Error" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
      expect(input).toHaveClass('focus-visible:ring-red-500');
    });

    it('applies default border styling when no error', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-gray-300');
    });
  });

  describe('States', () => {
    it('is interactive by default', async () => {
      const user = userEvent.setup();
      render(<Input />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');
      
      expect(input).toHaveValue('Hello');
    });

    it('is disabled when disabled prop is true', () => {
      render(<Input disabled />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('has disabled styling when disabled', () => {
      render(<Input disabled />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('disabled:cursor-not-allowed');
      expect(input).toHaveClass('disabled:opacity-50');
    });

    it('prevents interaction when disabled', async () => {
      const user = userEvent.setup();
      render(<Input disabled />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');
      expect(input).toHaveValue('');
    });

    it('supports different input types', () => {
      const types = ['text', 'email', 'password', 'number', 'tel', 'url'] as const;

      types.forEach((type) => {
        const { unmount } = render(<Input type={type} data-testid={`input-${type}`} />);
        const input = screen.getByTestId(`input-${type}`);
        expect(input).toHaveAttribute('type', type);
        unmount();
      });
    });

    it('supports placeholder attribute', () => {
      render(<Input placeholder="Enter your name" />);

      const input = screen.getByPlaceholderText('Enter your name');
      expect(input).toBeInTheDocument();
    });

    it('supports defaultValue', () => {
      render(<Input defaultValue="Initial value" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Initial value');
    });

    it('supports controlled value', () => {
      const { rerender } = render(<Input value="Controlled" onChange={() => {}} />);

      let input = screen.getByRole('textbox');
      expect(input).toHaveValue('Controlled');

      rerender(<Input value="Updated" onChange={() => {}} />);

      input = screen.getByRole('textbox');
      expect(input).toHaveValue('Updated');
    });

    it('calls onChange handler when value changes', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'a');

      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles input without label', () => {
      render(<Input placeholder="No label" />);

      const input = screen.getByPlaceholderText('No label');
      expect(input).toBeInTheDocument();
      expect(screen.queryByRole('label')).not.toBeInTheDocument();
    });

    it('handles long error messages', () => {
      const longError = 'This is a very long error message that should still be displayed correctly without breaking the layout or causing overflow issues in the UI component.';
      render(<Input error={longError} />);

      const error = screen.getByText(longError);
      expect(error).toBeInTheDocument();
      expect(error).toHaveClass('text-sm');
    });

    it('handles long helper text', () => {
      const longHelperText = 'This is a very long helper text that provides detailed instructions to the user about what kind of input is expected in this particular field.';
      render(<Input helperText={longHelperText} />);

      const helperText = screen.getByText(longHelperText);
      expect(helperText).toBeInTheDocument();
      expect(helperText).toHaveClass('text-sm');
    });

    it('handles special characters in input', async () => {
      const user = userEvent.setup();
      render(<Input />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      const specialChars = '!@#$%^&*()_+-=';
      
      await user.type(input, specialChars);
      expect(input).toHaveValue(specialChars);
    });

    it('handles empty string as error', () => {
      render(<Input error="" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('handles undefined error', () => {
      render(<Input error={undefined} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('handles multiple inputs with unique IDs', () => {
      render(
        <>
          <Input label="First Name" />
          <Input label="Last Name" />
          <Input label="Email" />
        </>
      );

      const inputs = screen.getAllByRole('textbox');
      const ids = inputs.map(input => input.id);
      
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('handles icon without iconPosition specified', () => {
      render(<Input icon={<EmailIcon />} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10');
    });

    it('handles rapid state changes', () => {
      const { rerender } = render(<Input error="Error 1" />);
      
      rerender(<Input error="" />);
      rerender(<Input error="Error 2" />);
      rerender(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('handles required without label', () => {
      render(<Input required />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('preserves HTML input attributes', () => {
      render(
        <Input 
          name="email"
          autoComplete="email"
          maxLength={50}
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('name', 'email');
      expect(input).toHaveAttribute('autocomplete', 'email');
      expect(input).toHaveAttribute('maxlength', '50');
      expect(input).toHaveAttribute('pattern', '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$');
    });
  });
});
