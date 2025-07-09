"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

export interface AlertProps {
  title?: string;
  message?: string;
  onConfirm?: () => void;
  onClose?: () => void;
}

export interface AlertLayoutProps {
  id: string;
  type: "alert" | "confirm";
  title?: string;
  message?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function AlertLayout({ alerts }: { alerts: AlertLayoutProps[] }) {
  const [currentAlert, setCurrentAlert] = useState<AlertLayoutProps | null>(null);

  useEffect(() => {
    if (alerts.length > 0) {
      setCurrentAlert(alerts[0]);
    } else {
      setCurrentAlert(null);
    }
  }, [alerts]);

  if (!currentAlert) {
    return null;
  }

  return (
    <AlertDialog
      open={!!currentAlert}
      onOpenChange={() => {
        if (currentAlert) {
          currentAlert.onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          {currentAlert.title && (
            <AlertDialogTitle>{currentAlert.title}</AlertDialogTitle>
          )}
          {currentAlert.message && (
            <AlertDialogDescription>{currentAlert.message}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {currentAlert.type === "confirm" && (
            <AlertDialogCancel
              onClick={() => {
                currentAlert.onClose();
              }}
            >
              取消
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={() => {
              currentAlert.onConfirm();
            }}
          >
            确定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
