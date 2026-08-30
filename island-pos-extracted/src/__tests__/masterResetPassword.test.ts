import { describe, it, expect, beforeEach } from 'vitest';
import { posDb } from '../services/db';

/**
 * Master Reset Password — lockout recovery for a forgotten admin PIN.
 * Setup lives in Admin → Store System & Audits; use is on the staff login screen.
 */
describe('Master Reset Password', () => {
  beforeEach(() => {
    // Establish a known admin PIN and clear any prior master reset secret.
    posDb.updateSettings({
      adminPin: 'SecretAdmin99',
      adminUsername: 'admin',
      adminPinMustChange: false,
      masterResetPassword: undefined,
      onboardingCompleted: true,
    });
    // Ensure the in-memory secret is cleared even if updateSettings omitted undefined.
    const s = posDb.getSettings();
    if (s.masterResetPassword) {
      posDb.setMasterResetPassword('', 'SecretAdmin99');
    }
  });

  it('reports no master reset when unset', () => {
    expect(posDb.hasMasterResetPassword()).toBe(false);
  });

  it('rejects setting master reset with wrong current admin PIN', () => {
    const res = posDb.setMasterResetPassword('RecoveryKey123', 'wrong-pin');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/incorrect/i);
    expect(posDb.hasMasterResetPassword()).toBe(false);
  });

  it('rejects master reset shorter than 6 characters', () => {
    const res = posDb.setMasterResetPassword('abc', 'SecretAdmin99');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/6 characters/i);
  });

  it('rejects master reset equal to the admin login PIN', () => {
    const res = posDb.setMasterResetPassword('SecretAdmin99', 'SecretAdmin99');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/different/i);
  });

  it('sets and reports master reset when admin PIN is correct', () => {
    const res = posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    expect(res.ok).toBe(true);
    expect(posDb.hasMasterResetPassword()).toBe(true);
    expect(posDb.getSettings().masterResetPassword).toBe('RecoveryKey123');
  });

  it('audits master_reset_password_change on set', () => {
    posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    const log = posDb.getAuditLog();
    const entry = log.find((e) => e.action === 'master_reset_password_change');
    expect(entry).toBeTruthy();
    expect(entry?.newValue).toBe('Configured');
  });

  it('clears master reset with empty password + correct admin PIN', () => {
    posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    const res = posDb.setMasterResetPassword('', 'SecretAdmin99');
    expect(res.ok).toBe(true);
    expect(posDb.hasMasterResetPassword()).toBe(false);
  });

  it('rejects login recovery when master reset is not configured', () => {
    const res = posDb.resetAdminPinViaMasterReset('anything');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not configured/i);
    expect(posDb.getSettings().adminPin).toBe('SecretAdmin99');
  });

  it('rejects login recovery with wrong master reset password', () => {
    posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    const res = posDb.resetAdminPinViaMasterReset('wrong-secret');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/incorrect/i);
    expect(posDb.getSettings().adminPin).toBe('SecretAdmin99');
  });

  it('resets admin PIN to admin123 and sets adminPinMustChange on success', () => {
    posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    const res = posDb.resetAdminPinViaMasterReset('RecoveryKey123');
    expect(res.ok).toBe(true);
    expect(res.temporaryPin).toBe('admin123');

    const settings = posDb.getSettings();
    expect(settings.adminPin).toBe('admin123');
    expect(settings.adminPinMustChange).toBe(true);

    // Staff admin user is synced
    const admin = posDb.getStaffUsers().find((u) => u.role === 'admin');
    expect(admin?.pin).toBe('admin123');
  });

  it('audits admin_pin_reset on successful recovery', () => {
    posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    posDb.resetAdminPinViaMasterReset('RecoveryKey123');
    const entry = posDb.getAuditLog().find((e) => e.action === 'admin_pin_reset');
    expect(entry).toBeTruthy();
    expect(entry?.newValue).toMatch(/admin123/i);
  });

  it('clears adminPinMustChange when admin PIN is changed away from default', () => {
    posDb.setMasterResetPassword('RecoveryKey123', 'SecretAdmin99');
    posDb.resetAdminPinViaMasterReset('RecoveryKey123');
    expect(posDb.getSettings().adminPinMustChange).toBe(true);

    posDb.updateSettings({ adminPin: 'NewSecurePin1' });
    expect(posDb.getSettings().adminPin).toBe('NewSecurePin1');
    expect(posDb.getSettings().adminPinMustChange).toBe(false);
  });
});
