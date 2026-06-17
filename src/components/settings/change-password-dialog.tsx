'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: string;
}

function getPasswordStrength(pwd: string): { score: number; label: string; color: string; viLabel: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { score, label: 'Weak', viLabel: 'Yeu', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Medium', viLabel: 'Trung binh', color: 'bg-amber-500' };
  return { score, label: 'Strong', viLabel: 'Manh', color: 'bg-red-500' };
}

export function ChangePasswordDialog({ open, onOpenChange, locale = 'vi' }: ChangePasswordDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const strength = getPasswordStrength(formData.newPassword);

  const resetForm = () => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!formData.currentPassword) {
      toast.error(t('Current password is required', 'Mat khau hien tai la bat buoc'));
      return;
    }
    if (formData.newPassword.length < 8) {
      toast.error(t('New password must be at least 8 characters', 'Mat khau moi phai it nhat 8 ky tu'));
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t('Passwords do not match', 'Mat khau khong khop'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(t('Password changed successfully', 'Doi mat khau thanh cong'));
        handleClose(false);
      } else {
        toast.error(json.error?.message || t('Failed to change password', 'Doi mat khau that bai'));
      }
    } catch (err) {
      console.error('Change password error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Change Password', 'Doi mat khau')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Current Password */}
          <div className="grid gap-2">
            <Label>{t('Current Password', 'Mat khau hien tai')} *</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={(e) => setFormData((p) => ({ ...p, currentPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="grid gap-2">
            <Label>{t('New Password', 'Mat khau moi')} *</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder={t('Min 8 characters', 'It nhat 8 ky tu')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>

            {/* Password Strength Indicator */}
            {formData.newPassword.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === 'vi' ? strength.viLabel : strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="grid gap-2">
            <Label>{t('Confirm New Password', 'Xac nhan mat khau moi')} *</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
              <p className="text-xs text-red-500">{t('Passwords do not match', 'Mat khau khong khop')}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('Change Password', 'Doi mat khau')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
