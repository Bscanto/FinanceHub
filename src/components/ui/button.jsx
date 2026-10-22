import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants = cva('button', {
  variants: {
    variant: { default: 'primary', secondary: 'secondary', ghost: 'ghost', danger: 'danger' },
    size: { default: '', small: 'small', icon: 'icon-button' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({ asChild = false, variant, size, className, ...props }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(variants({ variant, size }), className)} {...props} />;
}
