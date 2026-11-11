"use client";

import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
}

const DEFAULT_OPTIONS: ConfirmOptions = {
  title: "Confirm Action",
  description: "Are you sure you want to continue?",
  actionLabel: "Confirm",
  cancelLabel: "Cancel",
};

export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const closingValueRef = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>(DEFAULT_OPTIONS);

  const closeWithValue = (value: boolean) => {
    if (!resolverRef.current || closingValueRef.current !== null) return;
    closingValueRef.current = value;
    setOpen(false);
  };

  const finishClose = () => {
    const resolve = resolverRef.current;
    if (!resolve) return;
    resolverRef.current = null;
    const value = closingValueRef.current ?? false;
    closingValueRef.current = null;
    resolve(value);
  };

  const confirm = (nextOptions: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      if (resolverRef.current) {
        resolve(false);
        return;
      }
      resolverRef.current = resolve;
      closingValueRef.current = null;
      setOptions({
        ...DEFAULT_OPTIONS,
        ...nextOptions,
      });
      setOpen(true);
    });

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) closeWithValue(false);
      }}
    >
      <AlertDialogContent onCloseAutoFocus={finishClose}>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => closeWithValue(false)}>
            {options.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => closeWithValue(true)}>
            {options.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
