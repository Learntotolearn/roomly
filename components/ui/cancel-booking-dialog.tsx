"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CancelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (cancelReason: string) => void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export function CancelBookingDialog({
  open, onOpenChange, onConfirm, title = "确认取消预定吗？", message = "如确认要取消这个会议室预定，请输入取消理由", loading = false,
}: CancelBookingDialogProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!cancelReason.trim()) {
      setError("请输入取消理由");
      return;
    }
    setError("");
    onConfirm(cancelReason);
  };

  const handleCancel = () => {
    setCancelReason("");
    setError("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleCancel();
    } else {
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason" className="flex items-center">
              取消理由 <span className="text-red-500 ml-1">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="请输入取消理由（必填）"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                if (error && e.target.value.trim()) {
                  setError("");
                }
              }}
              rows={3}
              className={error ? "border-red-500" : ""}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>取消</Button>
          <Button onClick={handleConfirm} disabled={loading || !cancelReason.trim()}>
            {loading ? "处理中..." : "确定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 