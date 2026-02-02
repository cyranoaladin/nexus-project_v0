/**
 * Component Variants - Standardized Component Options
 *
 * Defines the available variants and sizes for all UI components.
 * Used with CVA (Class Variance Authority) for consistent component styling.
 *
 * Usage:
 * - Import in component definitions
 * - Use with cva() for variant generation
 * - Enforce consistency across the design system
 */

/**
 * Button Component Variants
 */
export const buttonVariants = {
  variant: {
    /**
     * default: Primary brand button (blue background)
     * Use for: Main CTAs, primary actions
     */
    default: {
      label: 'Default',
      description: 'Primary button with brand blue background',
    },

    /**
     * secondary: Secondary style button (light blue background)
     * Use for: Secondary actions, alternative CTAs
     */
    secondary: {
      label: 'Secondary',
      description: 'Secondary button with light blue background',
    },

    /**
     * accent: Accent style button (cyan background)
     * Use for: Highlight actions, special features
     */
    accent: {
      label: 'Accent',
      description: 'Accent button with cyan background',
    },

    /**
     * outline: Outlined button (border only)
     * Use for: Tertiary actions, cancel buttons
     */
    outline: {
      label: 'Outline',
      description: 'Button with border, no background',
    },

    /**
     * ghost: Minimal button (no background, no border)
     * Use for: Icon buttons, subtle actions
     */
    ghost: {
      label: 'Ghost',
      description: 'Minimal button with no background or border',
    },

    /**
     * link: Link-style button (underlined text)
     * Use for: Text links, inline actions
     */
    link: {
      label: 'Link',
      description: 'Button styled as a text link',
    },

    /**
     * destructive: Destructive action button (red background)
     * Use for: Delete actions, destructive operations
     */
    destructive: {
      label: 'Destructive',
      description: 'Red button for destructive actions',
    },
  },

  size: {
    /**
     * sm: Small button
     */
    sm: {
      label: 'Small',
      description: 'Compact button size',
    },

    /**
     * default: Default button size
     */
    default: {
      label: 'Default',
      description: 'Standard button size',
    },

    /**
     * lg: Large button
     */
    lg: {
      label: 'Large',
      description: 'Large button size for emphasis',
    },

    /**
     * icon: Square button for icons
     */
    icon: {
      label: 'Icon',
      description: 'Square button for icon-only usage',
    },
  },
} as const;

/**
 * Card Component Variants
 */
export const cardVariants = {
  variant: {
    /**
     * default: Standard card with subtle background
     * Use for: Content containers, panels
     */
    default: {
      label: 'Default',
      description: 'Standard card with subtle background',
    },

    /**
     * elevated: Card with elevated appearance (darker background + shadow)
     * Use for: Featured content, important sections
     */
    elevated: {
      label: 'Elevated',
      description: 'Card with elevated appearance and shadow',
    },

    /**
     * outlined: Card with border, no background
     * Use for: Secondary content, lightweight containers
     */
    outlined: {
      label: 'Outlined',
      description: 'Card with border and transparent background',
    },

    /**
     * ghost: Minimal card, no border or background
     * Use for: Grouping content without visual separation
     */
    ghost: {
      label: 'Ghost',
      description: 'Minimal card with no border or background',
    },
  },

  padding: {
    none: {
      label: 'None',
      description: 'No padding',
    },
    sm: {
      label: 'Small',
      description: 'Small padding',
    },
    default: {
      label: 'Default',
      description: 'Standard padding',
    },
    lg: {
      label: 'Large',
      description: 'Large padding',
    },
  },
} as const;

/**
 * Badge Component Variants
 */
export const badgeVariants = {
  variant: {
    /**
     * default: Neutral badge
     * Use for: General labels, tags
     */
    default: {
      label: 'Default',
      description: 'Neutral gray badge',
    },

    /**
     * secondary: Brand-colored badge
     * Use for: Featured labels, brand tags
     */
    secondary: {
      label: 'Secondary',
      description: 'Brand blue badge',
    },

    /**
     * success: Success state badge (green)
     * Use for: Success indicators, completed status
     */
    success: {
      label: 'Success',
      description: 'Green badge for success states',
    },

    /**
     * warning: Warning state badge (amber)
     * Use for: Warning indicators, pending status
     */
    warning: {
      label: 'Warning',
      description: 'Amber badge for warning states',
    },

    /**
     * error: Error state badge (red)
     * Use for: Error indicators, failed status
     */
    error: {
      label: 'Error',
      description: 'Red badge for error states',
    },

    /**
     * info: Informational badge (blue)
     * Use for: Information labels, neutral status
     */
    info: {
      label: 'Info',
      description: 'Blue badge for informational states',
    },

    /**
     * outline: Outlined badge
     * Use for: Subtle labels, secondary information
     */
    outline: {
      label: 'Outline',
      description: 'Badge with border and transparent background',
    },
  },

  size: {
    sm: {
      label: 'Small',
      description: 'Small badge',
    },
    default: {
      label: 'Default',
      description: 'Standard badge',
    },
    lg: {
      label: 'Large',
      description: 'Large badge',
    },
  },
} as const;

/**
 * Input Component Variants
 */
export const inputVariants = {
  variant: {
    /**
     * default: Standard input
     */
    default: {
      label: 'Default',
      description: 'Standard input with border',
    },

    /**
     * filled: Input with filled background
     */
    filled: {
      label: 'Filled',
      description: 'Input with filled background',
    },

    /**
     * ghost: Minimal input with no border
     */
    ghost: {
      label: 'Ghost',
      description: 'Minimal input with no border',
    },
  },

  size: {
    sm: {
      label: 'Small',
      description: 'Small input',
    },
    default: {
      label: 'Default',
      description: 'Standard input',
    },
    lg: {
      label: 'Large',
      description: 'Large input',
    },
  },
} as const;

/**
 * Alert Component Variants
 */
export const alertVariants = {
  variant: {
    default: {
      label: 'Default',
      description: 'Neutral alert',
    },
    success: {
      label: 'Success',
      description: 'Success alert (green)',
    },
    warning: {
      label: 'Warning',
      description: 'Warning alert (amber)',
    },
    error: {
      label: 'Error',
      description: 'Error alert (red)',
    },
    info: {
      label: 'Info',
      description: 'Informational alert (blue)',
    },
  },
} as const;

/**
 * Toast Component Variants
 */
export const toastVariants = {
  variant: {
    default: {
      label: 'Default',
      description: 'Neutral toast notification',
    },
    success: {
      label: 'Success',
      description: 'Success toast (green)',
    },
    warning: {
      label: 'Warning',
      description: 'Warning toast (amber)',
    },
    error: {
      label: 'Error',
      description: 'Error toast (red)',
    },
    info: {
      label: 'Info',
      description: 'Informational toast (blue)',
    },
  },
} as const;

/**
 * All component variants
 */
export const componentVariants = {
  button: buttonVariants,
  card: cardVariants,
  badge: badgeVariants,
  input: inputVariants,
  alert: alertVariants,
  toast: toastVariants,
} as const;

/**
 * Type exports for type-safe usage
 */
export type ButtonVariant = keyof typeof buttonVariants.variant;
export type ButtonSize = keyof typeof buttonVariants.size;

export type CardVariant = keyof typeof cardVariants.variant;
export type CardPadding = keyof typeof cardVariants.padding;

export type BadgeVariant = keyof typeof badgeVariants.variant;
export type BadgeSize = keyof typeof badgeVariants.size;

export type InputVariant = keyof typeof inputVariants.variant;
export type InputSize = keyof typeof inputVariants.size;

export type AlertVariant = keyof typeof alertVariants.variant;
export type ToastVariant = keyof typeof toastVariants.variant;

/**
 * Helper function to get variant classes
 * (Implementation depends on CVA setup in each component)
 */
export function getVariantDescription(
  component: keyof typeof componentVariants,
  type: 'variant' | 'size',
  value: string
): string {
  const componentDef = componentVariants[component] as any;
  const typeDef = componentDef[type];
  const variant = typeDef?.[value];

  return variant?.description || `${value} variant`;
}
