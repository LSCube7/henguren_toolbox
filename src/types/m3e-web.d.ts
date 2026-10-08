import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { M3eSnackbarElement } from "@m3e/web/snackbar";

// M3E 2.9's snackbar React export is an imperative service, not a React component.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "m3e-snackbar": DetailedHTMLProps<HTMLAttributes<M3eSnackbarElement>, M3eSnackbarElement> & {
        open?: boolean;
        duration?: number;
      };
    }
  }
}
