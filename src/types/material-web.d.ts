import type { DetailedHTMLProps, HTMLAttributes } from "react";

type MaterialWebElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [key: string]: unknown;
  checked?: boolean;
  disabled?: boolean;
  error?: boolean;
  href?: string;
  label?: string;
  max?: number | string;
  min?: number | string;
  name?: string;
  open?: boolean;
  rows?: number | string;
  selected?: boolean;
  target?: string;
  type?: string;
  value?: string | number;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      [tagName: `md-${string}`]: MaterialWebElementProps;
    }
  }
}
